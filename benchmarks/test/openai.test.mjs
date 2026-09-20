import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOpenAIRequest,outputSchema,parseResponse,estimatedCost} from '../openai/adapter.mjs';
const request={state:{question:'2+2',answer:'5'},questions:{diagnosis:{type:'choice',instructions:'Classify the error',criteria:{a:'arithmetic',b:'other'}}}};
const raw=answer=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answers:{diagnosis:answer}})}]}]});
const answer={type:'choice',choice:'a',probabilities:{a:.8,b:.2},confidence:.7};
test('OpenAI adapter preserves original questions and state and creates closed enum schema',()=>{
 const r=buildOpenAIRequest(request);
 assert.deepEqual(JSON.parse(r.input[1].content).questions,request.questions);
 assert.deepEqual(JSON.parse(r.input[2].content).state,request.state);
 assert.equal(r.store,false);assert.equal(r.text.format.strict,true);
 const schema=outputSchema(request).properties.answers.properties.diagnosis;
 assert.deepEqual(schema.properties.choice.enum,['a','b']);assert.equal(schema.additionalProperties,false);
 assert.deepEqual(schema.properties.probabilities.required,['a','b']);
});
test('OpenAI parsing rejects refusals, incomplete output, bad sums and inconsistent choice without repairing',()=>{
 assert.deepEqual(parseResponse(raw(answer),request).answers.diagnosis,answer);
 assert.throws(()=>parseResponse({...raw(answer),status:'incomplete'},request),/not complete/);
 assert.throws(()=>parseResponse({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},request),/refused/);
 assert.throws(()=>parseResponse(raw({...answer,probabilities:{a:.8,b:.8}}),request));
 assert.throws(()=>parseResponse(raw({...answer,choice:'b'}),request),/maximum/);
});
test('cost accounts for cached input and output including reasoning tokens',()=>{
 assert.ok(Math.abs(estimatedCost({input_tokens:1000,input_tokens_details:{cached_tokens:500},output_tokens:100})-.00023)<1e-12);
 assert.equal(estimatedCost({}),null);
});
