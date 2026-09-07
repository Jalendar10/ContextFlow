import React from 'react';
const questions=[
 ['Generate Python 3 code','Generate a complete Python 3 solution for the problem in this source. Follow its input and output format.'],
 ['Explain this code','Explain the code or algorithm in this source step by step.'],
 ['Find bugs','Review the code in this source for bugs and provide a corrected version.'],
 ['Show test cases','Generate useful test cases, including edge cases, for the problem in this source.'],
 ['Optimize the solution','Optimize the solution in this source and explain its time and space complexity.'],
 ['Summarize content','Summarize the key points in this source.']
];
export default function SuggestedQuestions({source,ready,busy,onAsk}){
 if(!source?.on)return null;
 return <details className="source-suggestions" open><summary>Quick questions</summary><div className="cf-prompts">{questions.map(([label,prompt])=><button key={label} disabled={busy||!ready} onClick={()=>onAsk(prompt,source.id)}>{label}<span aria-hidden="true">↗</span></button>)}</div></details>;
}
