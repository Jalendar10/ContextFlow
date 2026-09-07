# ContextFlow AI

A working local browser-content research workspace. There are no seeded sources, meetings, questions, or answers.

## Start

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. For the built application:

```sh
npm run build
npm start
```

Both serve the real Node backend on loopback. Run only one at a time. `npm run preview` also includes the backend on port 4173.

## Select a real browser tab

1. Use **Chrome or Edge**. The Codex in-app preview does not support installing Chrome extensions.
2. In ContextFlow, click **Select browser tabs → Download extension v3**, then unzip it. Alternatively, use the existing project folder:
   `extension/`
3. Open `chrome://extensions` or `edge://extensions`, enable Developer mode and choose **Load unpacked**. Select the extension folder. If the previous ContextFlow extension is installed, click its **Reload** button instead.
4. Refresh ContextFlow in that same browser. The header shows **Browser connected**. No pairing code is needed.
5. Click **Select browser tabs**. The list comes directly from your open browser windows. Select one or more tabs and click **Capture**.
6. Extension v3 declares HTTP/HTTPS access at installation. Reload the extension and approve the updated access if Chrome requests it; set **Site access → On all sites**. Capturing or refreshing a selected tab then opens no permission page, window or overlay. Chrome-managed permission warnings cannot be suppressed by the app.

The selected pages are extracted, sent to the local backend, and displayed as formatted Markdown. Headings, lists, code and tables retain their structure. Switch between **Formatted**, **Raw**, and **Links**, or download/copy the captured content.

## Current content and questions

- **Refresh content** reads the current loaded content of the selected tab again without reloading, scrolling or otherwise changing it.
- **Refresh sources before answering** is on by default. An answer is generated only after selected sources refresh successfully. Disable it explicitly to ask about saved snapshots.
- Capture timestamps update on each refresh; revisions increase when text changes.
- If the tab closed or navigated to a different URL, refresh fails and asks you to re-select it. The app does not silently answer from an older snapshot.
- Checkboxes in the sidebar control which captured sources enter an answer. Multiple selected sources can be compared.
- Answers come from your selected AI provider and model and include source citations. Click a citation to inspect the excerpt used for that answer. Follow-up questions use relevant recent conversation from the same selected source revisions.
- **Your questions** shows only questions you actually asked. Answers and source content can be exported as Markdown.

## Models, API keys and transcription

Open **Models & API keys** from the sidebar or click the AI status/model button. Choose the provider and model independently for **Question answers** and **Audio transcription**, then click **Use this model**. Available models are loaded from the provider's real model catalog. Selections persist across backend restarts.

- Answers: **Ollama**, **OpenAI**, **Anthropic**, **Google Gemini**, or **Groq**, plus custom OpenAI-compatible providers.
- Audio transcription: **OpenAI** or **Groq**. Add the corresponding API key to enable transcription.
- Add keys using **Save & test**. The test checks model-list access; inference permissions and billing are checked when a model is used. Keys can be tested again or removed.
- Keys stay in backend memory by default. **Remember on this computer** stores a plaintext credential file with owner-only permissions in `.contextflow/credentials.json`; it is not encrypted. The directory is excluded from Git and blocked by the development file server. Keys are never returned to the frontend after saving.
- Optional server environment keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`. See `.env.example`. Do not prefix secrets with `VITE_`.

Ollama connects to `http://127.0.0.1:11434` and defaults to the installed **gemma4:e4b** model (or `OLLAMA_MODEL` before a selection is saved). It requires no cloud key. Start Ollama before using local answers. Errors are displayed without canned-answer fallbacks.

Click **Transcribe audio** to upload an audio file or record your microphone. Recording requires browser microphone permission. Preview the recording, then click **Transcribe** to send it to the selected transcription provider. Audio is limited to 25 MB; supported file types depend on the provider. Review/edit the returned transcript, copy/export it, or choose **Use as question** to place it in the composer. This does not automatically submit the question. For continuous app audio, use **Open apps & audio** as described below.

Cloud answer providers receive the selected source excerpts and relevant conversation when you ask. The transcription provider receives audio only when you click Transcribe. Provider usage may incur charges to your account.

Use **Add an OpenAI-compatible provider** to enter another service’s API base URL, then add its key and test. The endpoint must support `/models`, `/chat/completions`, and `/audio/transcriptions` for speech. HTTPS is required except for loopback servers. Keys are sent only to the configured endpoint and redirects are rejected. The complete returned catalog is inspectable under each key; role menus exclude recognized incompatible model types. Whisper/transcription names are recognized dynamically. Declare other speech model IDs when adding a provider if needed. Model catalogs do not universally advertise endpoint compatibility, so a successful list test is not an inference guarantee.

## Desktop apps and live meeting audio (macOS)

```sh
npm run build:native
```

This compiles the Swift helper using Xcode Command Line Tools. It is already built on this Mac. The helper is stored at `.contextflow/ContextFlow Helper.app`. Native audio requires macOS 15 or later.

1. Open **Open apps & audio** in ContextFlow. The list comes from running macOS applications.
2. Use the access buttons if permissions are missing. macOS controls Accessibility, Screen & System Audio Recording, and Microphone permissions. Depending on launch attribution, access may apply to ContextFlow Helper or the app launching the backend. Refresh after granting access. The helper does not bypass OS prompts or recording indicators.
3. Select an application and click **Capture app text**. Window accessibility text is read without focus, scrolling or clicks. Chromium/Electron accessibility exposure is requested when needed. If the app does not expose a readable tree, visible-window OCR is used with screen permission, clearly labelled as partial. OCR does not include offscreen/unloaded text. Menu bars and secure text fields are excluded from accessibility capture.
4. Captured app text supports **Refresh content**, source selection and AI questions just like browser sources. For complete loaded webpage text, prefer extension tab capture.
5. For a Teams, Zoom or other meeting, select that running application, optionally enable **Include my microphone**, then click **Start listening & transcribing**. For a web meeting select its browser; capture includes all audible tabs in that browser, not one tab.
6. Audio is sent in approximately 15-second chunks to the selected transcription provider. The session pins the provider/model selected at start. The transcript becomes a source automatically; select it to ask questions. Microphone and app audio are separate labelled tracks, not speaker diarization.
7. **Stop** remains available in the workspace when the dialog closes. Closing the dialog does not stop listening. Backend exit, capture errors, excessive transcription backlog or the two-hour session limit stop recording. The selected app exiting may stop its audio without ending the session; use Stop explicitly. Session progress and errors are shown in Open apps & audio.

Temporary WAV chunks are held under the private `.contextflow/audio` directory and deleted after processing or normal session cleanup. Forced termination can leave temporary files there. Transcripts remain in backend memory until deleted or the backend restarts. Deleting the active transcript or clearing context stops/discards its pending transcription.

## Public webpages and linked research

**Public URL** fetches a real page on demand without the extension. This also works in the Codex preview. It formats the returned HTML and supports refresh and AI questions.

The **Links** view lists real links from a captured page. Click the plus button next to a link to capture that public page as an additional source for research. URL capture does not execute remote scripts, use login cookies, or fetch linked pages automatically. Use browser-tab capture for signed-in or dynamically rendered applications.

Public URL requests reject private/reserved addresses and nonstandard ports. DNS results are pinned for the connection and redirects are revalidated. Internal applications can be captured through explicitly selected browser tabs instead.

## Privacy and actual capture limits

- Captures and current workspace state are held locally in memory. Backend shutdown clears source content. Browser refresh clears conversation history. Downloaded exports are retained wherever you save them.
- Deleting a source removes its backend capture and related answers from the current UI. **Clear all captured context** clears all captures and the current conversation. Unsharing a source excludes it from future questions.
- The extension bridge runs only in the local ContextFlow app. Reading source content uses an isolated, read-only extraction function. It adds no elements, CSS, banners, messages, clicks, focus changes or scrolling to those pages.
- Capture means **all readable content loaded in the page**, including content below the viewport. It does not bypass authentication or invent rows that have not loaded. Virtualized tables/editors, closed shadow roots, cross-origin frames, canvas, images and browser PDF viewers can be incomplete or unsupported; detected limitations appear beside the captured content. Export the complete dataset from the source application when necessary.
- Text limit: 8 MB per page, 32 MB total local context. Oversized captures fail explicitly rather than silently truncating.
- Smaller documents are sent to the selected answer model in full. Larger documents are chunked and a bounded selection of approximately 34K characters is retrieved. Citations identify the actual excerpts used; a long-document summary is not an exhaustive read of every chunk.

## Verification

```sh
npm test
npm run build
```

Tests cover formatted extraction without modifying source DOM, complete loaded table rows, actual-source-only selection, source refresh/versioning, deletion and revocation, missing-model errors, local model request construction, API origin restrictions, public-URL address restrictions, and extension selection/permission boundaries. Tests use isolated fixtures; no fixtures or sample answers are seeded into the app.

Browser verification covered live public-page capture, automatic refresh before a question, a real local AI-generated answer, formatted rendering and citations. Installed-extension verification requires the user to load/reload v3 in Chrome/Edge; browser automation cannot operate the browser’s extension-management page.

Provider tests also cover independent model selections, credential storage/removal and permissions, provider request formats, transcription uploads and origin restrictions. Cloud HTTP calls use isolated test responses; live paid-provider inference requires your own API key.

Native verification: helper compilation, live running-app discovery and a real app-audio stream were checked on this Mac. Audio produced a 15-second segment and a final segment and stopped cleanly; verification audio was deleted. Desktop/provider tests use isolated test inputs and are never seeded into the workspace. Cloud transcription still requires a configured API key.

Editor capture in extension v3.1 includes current ordinary textarea values and rendered Monaco, CodeMirror and Ace lines with indentation preserved. It does not access private editor models, disable page protections or suppress browser/site security logs. Virtualized editors may expose only a subset of their code; use the editor's supported copy/export for the full file. ContextFlow's capture code has no console logging.

## License

[MIT](LICENSE) — Copyright (c) 2026 Jalendar Reddy.
