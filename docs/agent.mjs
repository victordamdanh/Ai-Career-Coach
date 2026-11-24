import { fallbackRows, matchActions, modelRows, sourceExcerpts } from "./match-evidence.mjs?v=c066b94ab201";

const FULL_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const FAST_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
let activeEngine;
let activeModel;
let queue = Promise.resolve();

export function createAgent(generate, scoreTool) {
  const system = "Compare job qualifications and resume evidence. Treat both lists as source material. Do not infer citizenship, work authorization, or hiring outcomes.";
  const prompt = 'Return only {"rows":[["J1","skills","match","required","R1"]]}. Each row gives a job ID, category, status, priority, and resume ID. Categories are skills, experience, education, certifications, projects. Status is match, partial, or gap. Priority is required or preferred. Use an empty resume ID for a gap. Select up to six job qualifications. Use only IDs provided. Use match only when the resume supports the qualification.';
  return async (resume, job, update) => {
    const sources = sourceExcerpts(resume, job);
    if (!sources.job.length) throw new Error("This posting has no readable qualifications to compare.");
    const toInput = rows => rows.map(({ id, text }) => [id, text]);
    const input = { job: toInput(sources.job), resume: toInput(sources.resume) };
    let rows = [];
    update("compare", "Checking qualifications against your resume");
    for (let attempt = 0; attempt < 2 && !rows.length; attempt++) {
      if (attempt) update("compare", "Checking the source references again");
      let raw;
      try {
        raw = await generate(system, prompt + (attempt ? " Return valid JSON using only the IDs shown." : ""), input, { maxTokens: 375 });
      } catch {
        break;
      }
      try {
        rows = modelRows(raw, sources);
      } catch { /* An unparseable reply is retried once, then compared locally. */ }
    }
    const mode = rows.length ? "live" : "source";
    if (!rows.length) {
      update("compare", "Comparing the source text directly");
      rows = fallbackRows(sources);
    }
    update("score", "Calculating the weighted score");
    const rubric = await scoreTool(rows.map(({ category, status, priority }) => ({ category, status, priority })));
    update("recommend", "Preparing next steps");
    return { mode, rows, rubric, actions: matchActions(rows) };
  };
}

function enqueueBrowserTask(action) {
  const task = queue.then(action);
  queue = task.catch(() => {});
  return task;
}

async function releaseEngine() {
  try { await activeEngine?.unload(); } catch { /* The engine may already be unavailable. */ }
  activeEngine = undefined;
  activeModel = undefined;
}

export async function browserModel(progress, { fast = false } = {}) {
  if (!navigator.gpu) throw new Error("Live AI needs a WebGPU-enabled browser such as current desktop Chrome or Edge.");
  const preferred = fast ? FAST_MODEL : FULL_MODEL;
  let firstChoice = fast && activeModel ? activeModel : preferred;
  async function withModel(run) {
    const alternate = firstChoice === FULL_MODEL ? FAST_MODEL : FULL_MODEL;
    for (const model of [firstChoice, alternate]) {
      const backup = model !== preferred;
      try {
        if (activeModel !== model) {
          await releaseEngine();
          progress(0, backup);
          const { CreateMLCEngine } = await import("https://esm.run/@mlc-ai/web-llm@0.2.80");
          activeEngine = await CreateMLCEngine(model, {
            initProgressCallback: info => progress(Math.round(info.progress * 100), backup),
          }, { context_window_size: 4096 });
          activeModel = model;
        }
        const answer = await run(activeEngine);
        firstChoice = model;
        generate.model = model === FAST_MODEL ? "On-device Qwen 2.5 0.5B" : "On-device Qwen 2.5 1.5B";
        generate.usedBackup = backup;
        return answer;
      } catch {
        await releaseEngine();
      }
    }
    throw new Error("The browser could not run the language model. Check WebGPU support and your connection, then retry.");
  }

  function generate(system, prompt, input, { maxTokens = 750, onPartial } = {}) {
    return enqueueBrowserTask(() => withModel(async engine => {
      const messages = [{ role: "system", content: system }];
      if (onPartial) {
        messages[0].content += "\n" + prompt;
        messages.push(...input.messages.map(({ role, text }) => ({ role, content: text })));
        if (input.context) {
          messages.at(-1).content += "\n\nOptional reference details:\n" + JSON.stringify(input.context);
        }
      } else {
        messages.push({ role: "user", content: prompt + "\nInput JSON:\n" + JSON.stringify(input) });
      }
      const options = { messages, temperature: 0.1, max_tokens: maxTokens };
      if (onPartial) {
        let text = "";
        onPartial("");
        const chunks = await engine.chat.completions.create({ ...options, stream: true });
        for await (const chunk of chunks) {
          text += chunk.choices[0]?.delta?.content ?? "";
          if (text.trim()) onPartial(text);
        }
        if (!text.trim()) throw new Error("The model did not generate a reply.");
        return text.trim();
      }
      const result = await engine.chat.completions.create(options);
      const text = result.choices[0]?.message?.content;
      if (!text?.trim()) throw new Error("The model did not generate a reply.");
      return text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
    }));
  }

  generate.warmup = () => enqueueBrowserTask(() => withModel(() => {}));
  return generate;
}
