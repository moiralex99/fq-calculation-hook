import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Mock fetchers
const evaluator = createJsonLogicEvaluator({
  getItem: async (collection, id, fields) => {
    return collection === 'projects' && id === 42
      ? { id: 42, name: 'Apollo', client: { id: 7, email: 'client@x.test' } }
      : null;
  },
  listItems: async (collection, filter, fields, limit) => {
    if (collection === 'users') return [ { id: 'u-1', email: 'a@test' }, { id: 'u-2', email: 'b@test' } ];
    return [];
  }
});

const { evaluateRule, evaluateValue } = evaluator;

const ctx = { task: { id: 10, project_id: 42, title: 'Fix bug' } };

const project = await evaluateValue({ lookup: [ 'projects', { var: 'task.project_id' }, ['id','name','client.email'], { __ctx: [] } ] }, ctx);
const projectName = await evaluateValue({ get: [ project, 'name' ] }, ctx);

console.log('project:', project);
console.log('projectName:', projectName);
