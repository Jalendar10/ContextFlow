import Foundation
import AppKit
import ApplicationServices
import ScreenCaptureKit
import AVFoundation
import Vision

func emit(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), let line = String(data: data, encoding: .utf8) { print(line); fflush(stdout) }
}
func fail(_ message: String) -> Never { emit(["error": message]); exit(1) }
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? { var value: CFTypeRef?; return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil }
func appFor(_ pid: pid_t, _ bundle: String) -> NSRunningApplication? {
    guard let app = NSRunningApplication(processIdentifier: pid), app.bundleIdentifier == bundle, !app.isTerminated else { return nil }; return app
}
func appList() -> [[String: Any]] {
    NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular && $0.bundleIdentifier != nil }.map { ["pid": Int($0.processIdentifier), "bundleId": $0.bundleIdentifier!, "name": $0.localizedName ?? $0.bundleIdentifier!, "active": $0.isActive] }.sorted { ($0["name"] as! String) < ($1["name"] as! String) }
}
func capture(_ pid: pid_t, _ bundle: String) throws {
    guard AXIsProcessTrusted() else { throw captureError("Enable Accessibility for ContextFlow Helper in macOS System Settings.") }
    guard let app = appFor(pid, bundle) else { fail("This application closed or restarted. Select it again.") }
    let root = AXUIElementCreateApplication(pid)
    AXUIElementSetMessagingTimeout(root, 1)
    // Chromium/Electron may not materialize their accessibility tree until a reader requests it.
    // This enables accessibility exposure only; it does not focus, click, or alter document content.
    _ = AXUIElementSetAttributeValue(root, "AXManualAccessibility" as CFString, kCFBooleanTrue)
    _ = AXUIElementSetAttributeValue(root, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
    Thread.sleep(forTimeInterval: 0.25)
    var lines = [String](), visited = Set<CFHashCode>(), count = 0, bytes = 0
    let start = Date()
    var limited = false
    func walk(_ node: AXUIElement, _ depth: Int) {
        if count >= 30000 || depth > 70 || Date().timeIntervalSince(start) > 15 || bytes > 7_000_000 { limited = true; return }
        let hash = CFHash(node); if visited.contains(hash) { return }; visited.insert(hash); count += 1
        let role = attribute(node, kAXRoleAttribute) as? String ?? ""
        let subrole = attribute(node, kAXSubroleAttribute) as? String ?? ""
        if subrole == kAXSecureTextFieldSubrole as String || ["AXMenuBar", "AXMenu", "AXMenuBarItem"].contains(role) { return }
        var values = [String]()
        for name in [kAXTitleAttribute, kAXValueAttribute, kAXDescriptionAttribute] {
            if let text = attribute(node, name) as? String {
                let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
                if !clean.isEmpty && !values.contains(clean) { values.append(clean) }
            }
        }
        if !values.isEmpty {
            let prefix = role == kAXWindowRole as String ? "## " : role == "AXHeading" ? "### " : role == kAXRowRole as String ? "- " : ""
            let line = prefix + values.joined(separator: " — ")
            if lines.last != line { lines.append(line); bytes += line.utf8.count }
        }
        if let children = attribute(node, kAXChildrenAttribute) as? [AXUIElement] { for child in children { walk(child, depth + 1); if limited { break } } }
    }
    // Read application windows, not the global menu bar or browsing-history menus.
    guard let windows = attribute(root, kAXWindowsAttribute) as? [AXUIElement], !windows.isEmpty else { throw captureError("The app has no accessible windows.") }
    for window in windows { walk(window, 0) }
    guard !lines.isEmpty else { throw captureError("This app exposes no readable accessibility text.") }
    var warnings = ["App capture reads the accessibility tree without focusing or changing the app. Images, protected fields, unloaded or virtualized content may be unavailable. Table structure depends on the app's accessibility support."]
    if limited { warnings.append("The app exceeded the capture time or node limit. This capture is partial.") }
    emit(["title": app.localizedName ?? bundle, "text": lines.joined(separator: "\n\n"), "warnings": warnings, "pid": Int(pid), "bundleId": bundle])
}

func captureError(_ message: String) -> NSError { NSError(domain: "ContextFlow", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
@available(macOS 14.0, *)
func captureOCR(_ pid: pid_t, _ bundle: String) async throws {
    guard CGPreflightScreenCaptureAccess() else { throw captureError("Enable Accessibility for app text, or Screen & System Audio Recording for visible-window OCR, then refresh.") }
    guard let app = appFor(pid, bundle) else { throw captureError("The app closed or restarted. Select it again.") }
    let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
    let windows = content.windows.filter { $0.owningApplication?.processID == pid && $0.windowLayer == 0 && $0.frame.width > 80 && $0.frame.height > 80 }
    guard !windows.isEmpty else { throw captureError("This app has no capturable windows. Open a window and try again.") }
    var sections = [String](), missed = 0
    for window in windows.prefix(12) {
        do {
            let config = SCStreamConfiguration()
            let scale = min(2.0, 4096.0 / max(window.frame.width, window.frame.height))
            config.width = Int(window.frame.width * scale); config.height = Int(window.frame.height * scale); config.showsCursor = false
            let image = try await SCScreenshotManager.captureImage(contentFilter: SCContentFilter(desktopIndependentWindow: window), configuration: config)
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate; request.usesLanguageCorrection = true; request.automaticallyDetectsLanguage = true
            try VNImageRequestHandler(cgImage: image).perform([request])
            let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
            if !text.isEmpty { sections.append("## " + (window.title ?? app.localizedName ?? bundle) + "\n\n" + text) }
        } catch { missed += 1 }
    }
    guard !sections.isEmpty else { throw captureError("No readable text was found in this app's windows. Protected or minimized windows may not be capturable.") }
    var warnings = ["Visible-window OCR was used because the app did not expose an accessibility tree. This is a partial visual capture: offscreen, unloaded and hidden content is not included, and OCR/table formatting can contain errors. Use browser-tab capture for full loaded webpage text."]
    if missed > 0 || windows.count > 12 { warnings.append("Some application windows could not be read or exceeded the 12-window OCR limit.") }
    emit(["title": app.localizedName ?? bundle, "text": sections.joined(separator: "\n\n"), "warnings": warnings, "pid": Int(pid), "bundleId": bundle])
}

@available(macOS 15.0, *)
final class AudioCapture: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let directory: URL
    let realtime: Bool
    var converters: [String: AVAudioConverter] = [:]
    var pendingPCM: [String: Data] = [:]
    let queue = DispatchQueue(label: "contextflow.audio")
    var files: [String: AVAudioFile] = [:]
    var paths: [String: URL] = [:]
    var frames: [String: AVAudioFramePosition] = [:]
    var stream: SCStream?
    var stopping = false
    init(directory: URL, realtime: Bool = false) { self.directory = directory; self.realtime = realtime }
    func flush(_ kind: String) {
        guard files[kind] != nil, let url = paths.removeValue(forKey: kind) else { return }
        var file = files.removeValue(forKey: kind)
        let duration = Double(file!.length) / file!.fileFormat.sampleRate
        // Releasing AVAudioFile closes and finalizes its header before the reader opens it.
        frames.removeValue(forKey: kind)
        file = nil
        emit(["event": "chunk", "path": url.lastPathComponent, "track": kind, "duration": duration])
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !stopping, sample.isValid, type == .audio || type == .microphone,
              let description = sample.formatDescription else { return }
        let format = AVAudioFormat(cmAudioFormatDescription: description)
        guard let pcm = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(sample.numSamples)) else { return }
        pcm.frameLength = AVAudioFrameCount(sample.numSamples)
        let result = CMSampleBufferCopyPCMDataIntoAudioBufferList(sample, at: 0, frameCount: Int32(sample.numSamples), into: pcm.mutableAudioBufferList)
        guard result == noErr else { return }
        let kind = type == .microphone ? "microphone" : "app"
        if realtime {
            if converters[kind] == nil {
                let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 24000, channels: 1, interleaved: true)!
                converters[kind] = AVAudioConverter(from: format, to: target)
            }
            guard let converter = converters[kind], let output = AVAudioPCMBuffer(pcmFormat: converter.outputFormat, frameCapacity: AVAudioFrameCount(Double(pcm.frameLength) * 24000 / format.sampleRate) + 64) else { return }
            var supplied = false; var conversionError: NSError?
            converter.convert(to: output, error: &conversionError) { _, state in
                if supplied { state.pointee = .noDataNow; return nil }
                supplied = true; state.pointee = .haveData; return pcm
            }
            if let conversionError { emit(["error": conversionError.localizedDescription]); return }
            if let samples = output.int16ChannelData, output.frameLength > 0 {
                pendingPCM[kind, default: Data()].append(Data(bytes: samples[0], count: Int(output.frameLength) * 2))
                if pendingPCM[kind]!.count >= 9600 { emit(["event": "pcm", "track": kind, "data": pendingPCM[kind]!.base64EncodedString()]); pendingPCM[kind] = Data() }
            }
            return
        }
        do {
            if files[kind] == nil {
                let url = directory.appendingPathComponent(UUID().uuidString + ".wav")
                files[kind] = try AVAudioFile(forWriting: url, settings: format.settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
                paths[kind] = url; frames[kind] = 0
            }
            try files[kind]!.write(from: pcm); frames[kind, default: 0] += AVAudioFramePosition(pcm.frameLength)
            if Double(frames[kind]!) / format.sampleRate >= 15 { flush(kind) }
        } catch { emit(["error": "Audio could not be saved: \(error.localizedDescription)"]); Task { await self.stop() } }
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) { emit(["error": error.localizedDescription]); Task { await self.stop() } }
    func start(pid: pid_t, bundle: String, microphone: Bool) async throws {
        guard appFor(pid, bundle) != nil else { throw NSError(domain: "ContextFlow", code: 1, userInfo: [NSLocalizedDescriptionKey: "Application closed or restarted. Select it again."]) }
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
        guard let app = content.applications.first(where: { $0.processID == pid && $0.bundleIdentifier == bundle }), let display = content.displays.first else {
            throw NSError(domain: "ContextFlow", code: 2, userInfo: [NSLocalizedDescriptionKey: "The selected app has no shareable content. Open its window and try again."])
        }
        if microphone {
            let allowed = await AVCaptureDevice.requestAccess(for: .audio)
            if !allowed { throw NSError(domain: "ContextFlow", code: 3, userInfo: [NSLocalizedDescriptionKey: "Microphone permission was not granted."]) }
        }
        let filter = SCContentFilter(display: display, including: [app], exceptingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true; config.excludesCurrentProcessAudio = true
        config.captureMicrophone = microphone
        config.sampleRate = 24000; config.channelCount = 1
        config.width = 2; config.height = 2; config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.showsCursor = false
        let s = SCStream(filter: filter, configuration: config, delegate: self)
        try s.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
        if microphone { try s.addStreamOutput(self, type: .microphone, sampleHandlerQueue: queue) }
        stream = s
        try await s.startCapture()
        emit(["event": "started", "pid": Int(pid), "microphone": microphone])
    }
    func stop() async {
        if stopping { return }
        if let stream { try? await stream.stopCapture() }
        queue.sync { stopping = true; for (kind, data) in pendingPCM where !data.isEmpty { emit(["event": "pcm", "track": kind, "data": data.base64EncodedString()]) }; pendingPCM.removeAll(); for kind in Array(files.keys) { flush(kind) } }
        emit(["event": "stopped"]); exit(0)
    }
}

@main struct Helper {
    @MainActor static func main() async {
        _ = NSApplication.shared
        let args = CommandLine.arguments
        guard args.count > 1 else { fail("Choose a helper command.") }
        switch args[1] {
        case "status": emit(["available": true, "accessibility": AXIsProcessTrusted(), "screenRecording": CGPreflightScreenCaptureAccess(), "microphone": AVCaptureDevice.authorizationStatus(for: .audio) == .authorized, "apps": appList()])
        case "permission":
            guard args.count > 2 else { fail("Choose a permission.") }
            if args[2] == "accessibility" { let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary; emit(["granted": AXIsProcessTrustedWithOptions(options)]) }
            else if args[2] == "audio" { emit(["granted": CGRequestScreenCaptureAccess()]) }
            else { fail("Unknown permission.") }
        case "capture":
            guard args.count == 4, let pid = Int32(args[2]), pid > 0 else { fail("Select an app.") }; do { try capture(pid, args[3]) } catch {
                if #available(macOS 14.0, *) { do { try await captureOCR(pid, args[3]) } catch { fail(error.localizedDescription) } } else { fail(error.localizedDescription) }
            }
        case "record":
            guard #available(macOS 15.0, *), (args.count == 6 || args.count == 7), let pid = Int32(args[2]), pid > 0 else { fail("App audio requires macOS 15 or later and a selected app.") }
            let recorder = AudioCapture(directory: URL(fileURLWithPath: args[4]), realtime: args.count == 7 && args[6] == "pcm")
            do { try await recorder.start(pid: pid, bundle: args[3], microphone: args[5] == "true") } catch { fail(error.localizedDescription) }
            DispatchQueue.global().async { _ = readLine(); Task { await recorder.stop() } }
            // Keep the recorder alive until stop input, parent exit, or a capture error.
            while true { try? await Task.sleep(for: .seconds(3600)); _ = recorder }
        default: fail("Unknown helper command.")
        }
    }
}
