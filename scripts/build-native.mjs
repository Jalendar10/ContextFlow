import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
if(process.platform==='win32'){
 const runtime=process.arch==='arm64'?'win-arm64':'win-x64';
 execFileSync('dotnet',['publish','native/windows-audio/ContextFlowAudio.csproj','-c','Release','-r',runtime,'--self-contained','true','-p:PublishSingleFile=true','-o','.contextflow/windows-audio'],{stdio:'inherit'});
 console.log('Built Windows app audio helper. Select Teams, Zoom or another running app in Meeting.');process.exit(0);
}
if(process.platform!=='darwin')throw Error('Use browser tabs or microphone on this operating system.');
const app='.contextflow/ContextFlow Helper.app/Contents';
mkdirSync(app+'/MacOS',{recursive:true,mode:0o700});
writeFileSync(app+'/Info.plist',`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>ContextFlowHelper</string><key>CFBundleIdentifier</key><string>ai.contextflow.desktop-helper</string><key>CFBundleName</key><string>ContextFlow Helper</string><key>CFBundleVersion</key><string>1</string><key>CFBundlePackageType</key><string>APPL</string><key>LSUIElement</key><true/><key>NSMicrophoneUsageDescription</key><string>Include your microphone in the meeting you choose to transcribe.</string><key>NSScreenCaptureUsageDescription</key><string>Capture audio from the application you select for live transcription.</string></dict></plist>`);
execFileSync('xcrun',['swiftc','-parse-as-library','-swift-version','5','-O','native/ContextFlowHelper.swift','-o',app+'/MacOS/ContextFlowHelper'],{stdio:'inherit'});
execFileSync('/usr/bin/xattr',['-cr','.contextflow/ContextFlow Helper.app']);
execFileSync('/usr/bin/codesign',['--force','--sign','-','--identifier','ai.contextflow.desktop-helper','.contextflow/ContextFlow Helper.app'],{stdio:'inherit'});
console.log('Built ContextFlow Helper. Grant macOS permissions from Open apps when needed.');
