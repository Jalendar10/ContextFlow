import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {OpenAITranscription} from '../server/openai-transcription.mjs';
class Socket extends EventEmitter {
 readyState=1;bufferedAmount=0;sent=[];
 send(data){this.sent.push(JSON.parse(data))}
 close(){this.emit('close')}
 terminate(){this.emit('close')}
}
function setup(){
 const text=[],errors=[];
 const stream=new OpenAITranscription({key:'test',model:'gpt-live-transcribe',track:'meeting',Socket,onText:e=>text.push(e),onError:e=>errors.push(e)});
 stream.socket.emit('open');
 stream.event({type:'session.updated'});
 return {stream,text,errors};
}
test('Realtime config streams PCM and forwards partials before final text',async()=>{
 const {stream,text}=setup();await stream.ready;
 assert.equal(stream.socket.sent[0].session.audio.input.transcription.model,'gpt-live-transcribe');
 assert.equal(stream.socket.sent[0].session.audio.input.turn_detection,null);
 stream.write(Buffer.alloc(9600));
 assert.equal(stream.socket.sent[1].type,'input_audio_buffer.append');
 stream.event({type:'conversation.item.input_audio_transcription.delta',item_id:'a',delta:'Hello'});
 assert.equal(text[0].text,'Hello');assert.equal(text[0].final,false);
 stream.abort();
});
test('Realtime orders final results and suppresses duplicate completion',()=>{
 const {stream,text}=setup();
 for(const item_id of ['a','b'])stream.event({type:'input_audio_buffer.committed',item_id});
 stream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'b',transcript:'Second'});
 assert.equal(text.length,0);
 stream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'a',transcript:'First'});
 stream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'a',transcript:'First'});
 assert.deepEqual(text.map(t=>t.text),['First','Second']);stream.abort();
});
test('Stop waits for the final commit acknowledgement and transcription',async()=>{
 const {stream,text}=setup();stream.write(Buffer.alloc(9600));
 let done=false;const finishing=stream.finish().then(()=>done=true);
 await Promise.resolve();assert.equal(done,false);
 stream.event({type:'input_audio_buffer.committed',item_id:'last'});
 await Promise.resolve();assert.equal(done,false);
 stream.event({type:'conversation.item.input_audio_transcription.completed',item_id:'last',transcript:'Last words'});
 await finishing;assert.equal(text[0].text,'Last words');assert.equal(stream.closed,true);
});

test('Live model commits after speech and silence while continuously uploading audio',()=>{
 const {stream}=setup();const speech=Buffer.alloc(9600);for(let i=0;i<speech.length;i+=2)speech.writeInt16LE(2000,i);
 stream.write(speech);for(let i=0;i<3;i++)stream.write(Buffer.alloc(9600));
 assert.equal(stream.socket.sent.filter(e=>e.type==='input_audio_buffer.append').length,4);
 assert.equal(stream.socket.sent.at(-1).type,'input_audio_buffer.commit');
 stream.abort();
});
