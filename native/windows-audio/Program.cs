using System.Diagnostics;
using System.Text.Json;
using NAudio.Wave;
using NAudio.CoreAudioApi;

internal static class Program
{
    private static readonly object OutputLock = new();
    private static void Emit(object message) { lock (OutputLock) Console.WriteLine(JsonSerializer.Serialize(message)); }
    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 20348)) throw new Exception("App audio requires Windows build 20348 or later (including Windows 11).");
            if (args.Length < 5 || args[0] != "record" || !int.TryParse(args[1], out var pid)) throw new Exception("Select a running application to record.");
            using var process = Process.GetProcessById(pid);
            if (!string.Equals(process.ProcessName, args[2], StringComparison.OrdinalIgnoreCase)) throw new Exception("The application restarted. Refresh and select it again.");
            bool microphone = args[4] == "true", realtime = args.Length > 5 && args[5] == "pcm";
            var format = new WaveFormat(24000, 16, 1);
            var finish = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            await using var app = await new WasapiRecorderBuilder().WithProcessLoopback((uint)pid, ProcessLoopbackMode.IncludeTargetProcessTree).WithFormat(format).WithBufferLength(100).BuildAsync();
            await using var mic = microphone ? new WasapiRecorderBuilder().WithFormat(format).WithBufferLength(100).Build() : null;
            var appSink = new Sink("app", args[3], realtime, format);
            var micSink = new Sink("microphone", args[3], realtime, format);
            void Failed(Exception? error) { if (error != null) Emit(new { error = "Application audio: " + error.Message }); finish.TrySetResult(); }
            app.DataAvailable += (buffer, flags, _, _) => { try { appSink.Write(buffer, flags.HasFlag(AudioClientBufferFlags.Silent)); } catch (Exception error) { Failed(error); } };
            app.RecordingStopped += (_, e) => Failed(e.Exception);
            if (mic != null) { mic.DataAvailable += (buffer, flags, _, _) => { try { micSink.Write(buffer, flags.HasFlag(AudioClientBufferFlags.Silent)); } catch (Exception error) { Failed(error); } }; mic.RecordingStopped += (_, e) => Failed(e.Exception); }
            app.StartRecording(); mic?.StartRecording();
            Emit(new { @event = "started", sampleRate = 24000, channels = 1 });
            _ = Task.Run(() => { Console.ReadLine(); finish.TrySetResult(); }); // EOF also stops when the backend exits.
            await Task.WhenAny(finish.Task, Task.Delay(TimeSpan.FromHours(2)));
            app.StopRecording(); mic?.StopRecording();
            await app.DisposeAsync(); if (mic != null) await mic.DisposeAsync();
            appSink.Flush(); micSink.Flush();
            return 0;
        }
        catch (Exception error) { Emit(new { error = error.Message }); return 1; }
    }
    private sealed class Sink(string track, string directory, bool realtime, WaveFormat format)
    {
        private readonly MemoryStream pending = new();
        private readonly object gate = new();
        public void Write(ReadOnlySpan<byte> buffer, bool silent)
        {
            lock (gate)
            {
                var remaining = buffer;
                while (remaining.Length > 0)
                {
                    int count = Math.Min(remaining.Length, (realtime ? 9600 : 720000) - (int)pending.Length);
                    if (silent) pending.Write(new byte[count]); else pending.Write(remaining[..count]);
                    remaining = remaining[count..];
                    if (pending.Length >= (realtime ? 9600 : 720000)) Flush();
                }
            }
        }
        public void Flush()
        {
            lock (gate)
            {
                if (pending.Length == 0) return;
                var bytes = pending.ToArray(); pending.SetLength(0);
                if (realtime) Emit(new { @event = "pcm", track, data = Convert.ToBase64String(bytes) });
                else
                {
                    Directory.CreateDirectory(directory);
                    var name = track + "-" + Guid.NewGuid().ToString("N") + ".wav";
                    using (var writer = new WaveFileWriter(Path.Combine(directory, name), format)) writer.Write(bytes, 0, bytes.Length);
                    Emit(new { @event = "chunk", track, path = name });
                }
            }
        }
    }
}
