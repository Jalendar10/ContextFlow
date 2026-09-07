# ContextFlow AI

**Ask questions about your browser content, and get help following meetings and interview practice in one workspace.**

ContextFlow runs on your computer. You choose a browser tab, webpage, or supported desktop app, then ask an AI model about its content. During a meeting, it can transcribe audio, collect the conversation into readable paragraphs, and draft answers using your reference material and a reusable agent.

For example, you can capture a technical problem, ask for Python or SQL code, and copy the answer. Or you can listen to a discussion, wait until someone finishes explaining a scenario, and click **Ask agent** to get an answer that uses the preceding conversation.

## What you can do

| Feature | What it helps you do |
| --- | --- |
| Research workspace | Read captured content and ask questions with source citations. |
| Browser tab capture | Capture readable content from a selected, already-open tab, including signed-in pages. |
| Public webpages | Fetch a public URL or add a linked page as another source. |
| Desktop app capture | Read accessible app text on macOS, with visible-window OCR when necessary. |
| Live transcript | Transcribe a selected tab, app, microphone, or app/tab audio plus your microphone. |
| Meeting and interview responses | Request a direct answer, explanation, steps, SQL/code, and an example where appropriate. |
| Agents & skills | Save a model, instructions, reference content, files, and skills as a reusable assistant. |
| Meeting history | Revisit saved transcripts and answers, play recordings, and download them. |
| Usage & costs | Inspect requests by model, tokens when reported, duration, and estimated cost. |

## How the workspace works

### Research a source

1. Capture a browser tab, public webpage, or supported desktop app.
2. Read its formatted content, raw text, or links.
3. Ask a question or click a quick action such as **Generate Python 3 code**.
4. Review the answer and its citations, then copy the answer or an individual code block.

By default, questions use the source open in the workspace. Enable **Use multiple sources** to compare selected sources. Quick actions do not call a model until you click them.

**Refresh sources before answering** reads the current content before generating an answer. If a selected browser tab navigates, refreshing follows that same tab to its current page. Closed or inaccessible tabs produce an error. Turn refresh off to work with the captured snapshot.

The source and answer panels have a draggable divider. Captured content and answers can be copied or exported.

### Follow a meeting or practice an interview

Open **Meeting**, expand **Audio source, agent & meeting settings**, and choose your audio source and agent.

- **Selected browser tab:** select a tab in the browser's capture picker and enable **Share tab audio**.
- **Selected desktop app:** capture audio from a running macOS application. Selecting a browser app includes its audible tabs.
- **Microphone:** use microphone audio alone, or include it alongside tab/app audio.

The transcript and agent responses fill the meeting window. Drag the middle divider to change their widths; each column scrolls independently.

**Meeting** style focuses on concise replies. **Interview** style asks for a direct answer followed by explanation, steps, relevant SQL/code, and an example. Interview style defaults to manual answers so the speaker can finish describing a scenario.

Not every sentence needs an answer. Click **Ask agent** on a transcript paragraph to request one, or type a question yourself. The request includes preceding transcript context and the agent's reference material. You can also enable automatic question detection and answer generation.

When meeting audio plays through speakers, the microphone may capture the same speech again. **Analyze speech from → Selected tab / app only** avoids analyzing both copies while still recording the microphone when enabled.

Answers appear in ContextFlow; they are not spoken or posted to the meeting.

### Choose Streaming or Batch

In **Models & API keys → Meeting & interview transcription**, choose:

| Mode | Behavior |
| --- | --- |
| **Streaming — default** | Sends audio continuously to a supported OpenAI or Deepgram model. Partial text depends on the model. |
| **Batch** | Sends short audio segments after a pause or up to approximately four seconds of speech, then waits for the provider's result. |

Your chosen provider and model remain selected. Unsupported streaming combinations show an error rather than silently switching providers.

OpenAI's integrated streaming models include `gpt-live-transcribe`, `gpt-transcribe`, `gpt-4o-transcribe`, and `gpt-4o-mini-transcribe`, subject to account availability. `gpt-transcribe` waits for a committed speech turn; continuous audio upload does not mean every model produces text while speech is still ongoing. Deepgram streaming supports estimated speaker labels. Other integrations label audio sources rather than identifying people.

Streaming reduces application buffering, but transcription and answers still require provider processing and network time. It is not a zero-delay guarantee.

### Reuse agents, skills, content, and files

Open **Agents & skills** to create an agent for a recurring task.

An agent brings together:

- The answer provider and model.
- Meeting or interview response style.
- Reusable skills and instructions.
- Primary content, additional content, and supported reference files.
- The prompt used to guide its answers.

Select the agent in meeting settings. Its configuration is captured when the session starts, so you do not need to re-enter the same context for every meeting. Manual context remains available when no agent is selected.

### Revisit history and recordings

Live meetings save transcripts, questions, answers, and recordings locally. Open **Meeting history** to review them, play the audio, or download the recording and transcript data.

When both sources are enabled, meeting audio and microphone audio are recorded on separate channels in a WAV file. Closing the meeting window keeps listening; reopen it and click **Stop** to finish. Stopping finalizes pending audio and answers. Restarting the backend ends live sessions.

### Understand model usage

**Usage & costs** lists model requests, processing time, reported token usage, and cost estimates where pricing is available. Custom pricing can be configured. Missing token or pricing data is shown as unavailable, not as a free request. Estimates are not a substitute for the provider's bill.

## Providers and model selection

Answer and transcription models are configured independently.

| Provider | Answers | Transcription |
| --- | --- | --- |
| OpenAI | Yes | Streaming and batch, depending on model |
| Google Gemini | Yes | Batch |
| Anthropic | Yes | No |
| Groq | Yes | Batch |
| Deepgram | No | Streaming and batch, depending on model |
| ElevenLabs | No | Batch Scribe integration |
| Ollama | Local answers | No |
| Custom OpenAI-compatible endpoint | If supported | Batch, if supported |

**Save & test** verifies connection/catalog access; it does not guarantee permission to run every listed model. Inference access and billing are checked when used. ElevenLabs exposes documented Scribe choices after account verification.

You can configure an answer fallback model in settings. When fallback is used, the answer identifies the model used.

Custom endpoints need the relevant OpenAI-compatible API routes, such as `/models`, `/chat/completions`, and `/audio/transcriptions`. Use HTTPS except for local loopback services.

## Data, privacy, and limits

- The server binds to loopback for use on your own computer.
- Cloud answer models receive the context supplied for the request. Cloud transcription providers receive captured or uploaded audio. Provider charges may apply.
- Keys stay in backend memory unless **Remember on this computer** is enabled. Remembered keys are stored in a plaintext file with owner-only permissions, not encrypted.
- Settings, agents, meeting history, recordings, and usage records live under `.contextflow/`. This directory and environment files are excluded from Git.
- Captured research sources are primarily held in backend memory; export important material before restarting. Research conversation state is not the same as persistent meeting history.
- Browser and OS permission prompts and capture indicators remain visible. ContextFlow cannot remove them.
- Page capture reads accessible, loaded content. It does not bypass authentication, editor protection, or browser restrictions. Virtualized tables/editors, closed shadow roots, canvas, and some frames may expose incomplete content.
- Desktop OCR reads visible content, not offscreen or unloaded material.
- Public URL capture fetches HTML without your browser cookies or executing page scripts. Use tab capture for dynamic or signed-in pages.
- Large documents use selected excerpts within a bounded context budget. Citations identify the excerpts used; a response is not proof that every row or page was read.
- Use recording and transcription with the permissions and consent required for your meeting.

## License

[MIT License](LICENSE) — Copyright (c) 2026 Jalendar Reddy.

## Setup and run

### 1. Install prerequisites

- **Node.js 24.15+** (24.x), **22.22.2+** (22.x), or **26+**, and npm, matching the installed dependencies.
- **Chrome or Edge** for the browser extension and tab audio workflow.
- A supported provider API key, or a running Ollama instance for local answers.
- Optional desktop capture: **macOS 15+** and Xcode Command Line Tools.

### 2. Clone and install

```sh
git clone https://github.com/Jalendar10/ContextFlow.git
cd ContextFlow
npm ci
```

### 3. Start the application

For development:

```sh
npm run dev
```

For a built application:

```sh
npm run build
npm start
```

Open **http://localhost:5173**. Both options include the Node backend; run only one at a time. Keep the terminal process running. Stop an active meeting before shutting it down.

### 4. Configure models

1. Open **Models & API keys**.
2. Add a provider key and click **Save & test**.
3. Select the answer model and click **Use this model**.
4. Select a transcription provider/model if you want audio features.
5. Keep **Streaming** for a compatible live model, or choose **Batch**.
6. Optionally configure fallback and save an agent in **Agents & skills**.

For local answers, start Ollama at `http://127.0.0.1:11434`, install an appropriate model, and select it in ContextFlow.

You may alternatively provide server environment variables listed in [.env.example](.env.example). Export them in the server process environment; never use a `VITE_` prefix for secrets. The settings UI is the simplest key setup.

### 5. Install the browser extension (optional)

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension/` folder.
4. Approve the requested site access. Set **Site access → On all sites** for capture across your selected pages.
5. Refresh ContextFlow in that same browser. The header should show **Browser connected**.
6. Open **Browser tabs**, select a tab, and capture it.

You can also download the extension ZIP from ContextFlow and unzip it before loading. After extension updates, click **Reload** on its extension-management card and refresh ContextFlow. The Codex in-app browser cannot install this Chrome extension.

### 6. Enable macOS app capture (optional)

Install Command Line Tools if necessary:

```sh
xcode-select --install
```

Build the helper:

```sh
npm run build:native
```

Open **Open apps & audio** and grant the requested macOS Accessibility, Screen & System Audio Recording, and Microphone permissions as needed. Refresh the app list afterward. The helper is built locally under `.contextflow/ContextFlow Helper.app`; it is not included as a prebuilt binary.

Use **Meeting → Selected desktop app** for the streaming/batch meeting workflow. The separate **Open apps & audio** listening workflow uses longer chunks and is not the low-latency meeting interface.

### 7. Verify and troubleshoot

```sh
npm test
npm run build
```

- **Localhost does not open:** keep `npm run dev` or `npm start` running; check for another process using port 5173.
- **Browser disconnected:** load/reload the extension and open ContextFlow in the same Chrome/Edge profile.
- **No audio:** enable **Share tab audio**, play speech in the selected source, and check the audio meter and OS permissions.
- **Streaming model unsupported:** choose a supported model in your account or switch to Batch.
- **Provider error:** check the selected model, key permissions, credit balance, and context size.
- **Changes not visible:** rebuild for `npm start`, then refresh the page after stopping any active recording. Restart the server for backend changes.
