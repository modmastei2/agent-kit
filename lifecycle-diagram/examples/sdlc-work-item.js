// Reference example: the SDLC lifecycle of one work item tracked on GitHub
// (issue -> pull request -> deployments). It exists to show the data format and the
// expected depth — every field is illustrative, none of it is a rule for other pages.
// Payload shapes are from general knowledge of the GitHub REST API (tagged 'gen').
window.DATA = (function(){
const REPO = '/repos/{owner}/{repo}';
const HDRS = `Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28`;

const hook = (event, payload, note) => ({
  title:`${event} webhook`, method:'EVENT', path:'POST → https://<your-host>/webhooks/github', tag:'gen',
  note:(note ? note + ' · ' : '') + 'Verify <code>X-Hub-Signature-256</code> on the raw body, store it, reply 2xx fast. Branch on the <code>X-GitHub-Event</code> header plus <code>action</code>.',
  req:`POST /webhooks/github
X-GitHub-Event: ${event}
X-GitHub-Delivery: 72d3162e-cc78-11e3-81ab-4c9367dc0958
X-Hub-Signature-256: sha256=<hex(HMAC-SHA256(secret, raw_body))>

${payload}`, reqLabel:'You receive', res:'HTTP/1.1 204 No Content', resLabel:'You reply (within ~10 s)'});

const GET_ISSUE = {
  title:'Get issue — current state of the work item', method:'GET', path:`${REPO}/issues/{number}`, tag:'gen',
  note:'The source of truth after any webhook. <code>state</code> is only open/closed; the board column lives in labels or a Projects field.',
  req:`GET ${REPO}/issues/42
${HDRS}`,
  res:`{
  "number": 42,
  "state": "open",                 // open | closed
  "state_reason": null,            // completed | not_planned | reopened (when closed/reopened)
  "title": "Export invoices as CSV",
  "labels": [ { "name": "ready" } ],
  "assignees": [ { "login": "dev-a" } ],
  "updated_at": "2026-10-14T09:12:44Z"
}`};
const ADD_LABEL = {
  title:'Add / remove a label — move across the board', method:'POST', path:`${REPO}/issues/{number}/labels`, tag:'gen',
  note:'Teams that model columns as labels move an item by swapping labels. Remove with <code>DELETE …/labels/{name}</code>.',
  req:`POST ${REPO}/issues/42/labels
${HDRS}

{ "labels": ["ready"] }`,
  res:`[ { "name": "ready", "color": "0e8a16" } ]`};
const CLOSE_NOT_PLANNED = {
  title:'Close as not planned — cancel', method:'PATCH', path:`${REPO}/issues/{number}`, tag:'gen',
  note:'<code>state_reason</code> is what separates "cancelled" from "done" — both are <code>state: closed</code>.',
  req:`PATCH ${REPO}/issues/42
${HDRS}

{ "state": "closed", "state_reason": "not_planned" }`,
  res:`{ "number": 42, "state": "closed", "state_reason": "not_planned" }`};
const OPEN_PR = {
  title:'Create pull request', method:'POST', path:`${REPO}/pulls`, tag:'gen',
  note:'Put <code>Closes #42</code> in the body so merging closes the issue as completed.',
  req:`POST ${REPO}/pulls
${HDRS}

{
  "title": "Export invoices as CSV",
  "head": "feat/42-invoice-csv",
  "base": "main",
  "body": "Closes #42",
  "draft": false
}`,
  res:`{ "number": 108, "state": "open", "draft": false, "mergeable_state": "unknown", "head": { "sha": "6dcb09b…" } }`};
const REVIEW = {
  title:'Submit review', method:'POST', path:`${REPO}/pulls/{number}/reviews`, tag:'gen',
  req:`POST ${REPO}/pulls/108/reviews
${HDRS}

{ "event": "REQUEST_CHANGES", "body": "Handle empty invoice lists" }   // or APPROVE / COMMENT`,
  res:`{ "id": 80, "state": "CHANGES_REQUESTED", "commit_id": "6dcb09b…" }`};
const MERGE = {
  title:'Merge pull request', method:'PUT', path:`${REPO}/pulls/{number}/merge`, tag:'gen',
  note:'Fails with 405 when required reviews or checks are not satisfied, 409 when the head moved — re-read the PR before retrying.',
  req:`PUT ${REPO}/pulls/108/merge
${HDRS}

{ "merge_method": "squash", "sha": "6dcb09b…" }`,
  res:`{ "sha": "e5bd391…", "merged": true, "message": "Pull Request successfully merged" }`};
const DEPLOY = env => ({
  title:`Create deployment (${env})`, method:'POST', path:`${REPO}/deployments`, tag:'gen',
  note:'A deployment is a record your pipeline reports progress on — creating it does not deploy anything by itself.',
  req:`POST ${REPO}/deployments
${HDRS}

{ "ref": "e5bd391", "environment": "${env}", "auto_merge": false, "required_contexts": [] }`,
  res:`{ "id": 1, "sha": "e5bd391…", "environment": "${env}" }`});
const DEPLOY_STATUS = (state, env) => ({
  title:`Report deployment status (${state})`, method:'POST', path:`${REPO}/deployments/{id}/statuses`, tag:'gen',
  note:'States: <code>queued</code>, <code>in_progress</code>, <code>success</code>, <code>failure</code>, <code>error</code>, <code>inactive</code>. A newer successful deployment marks older ones <code>inactive</code>.',
  req:`POST ${REPO}/deployments/1/statuses
${HDRS}

{ "state": "${state}", "environment": "${env}", "log_url": "https://ci.example.com/runs/991" }`,
  res:`{ "id": 7, "state": "${state}", "environment": "${env}" }`});

return {
name:'SDLC work item', title:'SDLC Work Item Lifecycle', lang:'en',
accent:{light:'#0b7a75', dark:'#5fd1c8'},
lead:'One "thing" = <b>one work item</b>: a GitHub issue, the pull request that implements it, and the deployments that ship it. No single API field holds this status — it is <b>derived</b> from three objects.',
facts:[
  {k:'Status lives on', v:'issue + PR + deployment'},
  {k:'API base', v:'<code>api.github.com</code>'},
  {k:'Webhook ack', v:'2xx within ~10 s'},
  {k:'Rate limit', v:'5,000 req/h per token'},
  {k:'Done means', v:'running in production'}
],
callout:'⚠ <b>Closed ≠ done.</b> A cancelled item is also <code>state: closed</code> — read <code>state_reason</code>. And a merged PR is not released: only a successful production deployment is.',
rows:['DELIVERY','REWORK · SIDE STATES','CANCELLED · INCIDENT'],
top:70,
effects:{
  none:{label:'Not deployed', tone:'gray'},
  staging:{label:'On staging', tone:'amber'},
  prod:{label:'In production', tone:'green'},
  reverted:{label:'Reverted', tone:'red'}
},
actors:{pm:'Product owner', dev:'Developer', reviewer:'Reviewer', ci:'CI/CD pipeline', oncall:'On-call'},
nodes:[
 {id:'BACKLOG', raw:'issue: open · no "ready" label', code:'BACKLOG', short:'Captured, not refined', col:0, row:0, kind:'start', level:'issue', mapped:'backlog', effect:'none', who:['pm'], tag:'gen',
  desc:'The item exists but is not refined enough to start. Most items that get cancelled die here.',
  webhook:hook('issues', `{ "action": "opened", "issue": { "number": 42, "state": "open", "labels": [] } }`, 'First time you hear about the item'),
  apis:[GET_ISSUE, ADD_LABEL]},
 {id:'READY', raw:'issue: open · label "ready"', code:'READY', short:'Refined, can start', col:1, row:0, level:'issue', mapped:'ready', effect:'none', who:['pm'], tag:'gen',
  desc:'Acceptance criteria agreed; anyone may pick it up.',
  webhook:hook('issues', `{ "action": "labeled", "label": { "name": "ready" }, "issue": { "number": 42 } }`),
  apis:[ADD_LABEL, CLOSE_NOT_PLANNED]},
 {id:'IN_PROGRESS', raw:'issue: assigned · branch pushed', code:'IN_PROGRESS', short:'Being built', col:2, row:0, level:'issue + branch', mapped:'in_progress', effect:'none', who:['dev'], tag:'gen',
  desc:'Someone is assigned and a branch exists. Rework from review or staging also lands here.',
  webhook:hook('issues', `{ "action": "assigned", "assignee": { "login": "dev-a" }, "issue": { "number": 42 } }`),
  apis:[OPEN_PR, GET_ISSUE], gotchas:['Assignment alone is a weak signal — treat "branch pushed" or a draft PR as the real start if you measure cycle time.']},
 {id:'BLOCKED', raw:'label "blocked"', code:'BLOCKED', short:'Waiting on something', col:1.6, row:1, kind:'side', level:'issue label', mapped:'blocked', effect:'none', who:['dev'], tag:'gen', map:false,
  desc:'Not a GitHub state — a label teams add while work cannot continue. Time spent here is usually what you want to see.',
  apis:[ADD_LABEL]},
 {id:'IN_REVIEW', raw:'pull_request: open · review_requested', code:'IN_REVIEW', short:'Awaiting review', col:3, row:0, level:'pull request', mapped:'in_review', effect:'none', who:['dev','reviewer'], tag:'gen',
  desc:'A non-draft PR exists and reviewers are requested. CI checks run alongside; required checks must pass before merge.',
  webhook:hook('pull_request', `{ "action": "review_requested", "number": 108, "pull_request": { "state": "open", "draft": false } }`),
  apis:[REVIEW, MERGE]},
 {id:'CHANGES', raw:'review.state: CHANGES_REQUESTED', code:'CHANGES_REQUESTED', short:'Reviewer wants changes', col:3, row:1, kind:'side', level:'review', mapped:'in_progress', effect:'none', who:['reviewer'], tag:'gen',
  desc:'The PR stays open; the item goes back to development until a new push and re-review.',
  webhook:hook('pull_request_review', `{ "action": "submitted", "review": { "state": "changes_requested" }, "pull_request": { "number": 108 } }`),
  apis:[REVIEW]},
 {id:'MERGED', raw:'pull_request: closed · merged: true', code:'MERGED', short:'Merged to main', col:4, row:0, level:'pull request', mapped:'merged', effect:'none', who:['dev'], tag:'gen',
  desc:'Code is on <code>main</code> and the linked issue auto-closes as completed — but nothing is deployed yet.',
  webhook:hook('pull_request', `{ "action": "closed", "number": 108, "pull_request": { "merged": true, "merge_commit_sha": "e5bd391…" } }`, '<code>closed</code> fires for both merge and abandon — check <code>merged</code>'),
  apis:[DEPLOY('staging')], gotchas:['A PR closed with <code>merged: false</code> is abandoned, not shipped.']},
 {id:'STAGING', raw:'deployment_status: success · env staging', code:'ON_STAGING', short:'Verified on staging', col:5, row:0, level:'deployment', mapped:'in_qa', effect:'staging', who:['ci'], tag:'gen',
  desc:'Deployed to staging for QA. A QA failure sends the item back to development.',
  webhook:hook('deployment_status', `{ "action": "created", "deployment_status": { "state": "success", "environment": "staging" }, "deployment": { "id": 1, "sha": "e5bd391…" } }`),
  apis:[DEPLOY_STATUS('success','staging'), DEPLOY('production')]},
 {id:'RELEASED', raw:'deployment_status: success · env production', code:'RELEASED', short:'Live in production', col:6, row:0, kind:'ok', end:true, level:'deployment', mapped:'done', effect:'prod', who:['ci'], tag:'gen',
  desc:'The only state that means <b>done</b>. Production incidents can still pull it back out.',
  webhook:hook('deployment_status', `{ "action": "created", "deployment_status": { "state": "success", "environment": "production" } }`),
  apis:[DEPLOY_STATUS('success','production')]},
 {id:'INCIDENT', raw:'deployment_status: failure / error · or incident opened', code:'INCIDENT', short:'Broken in production', col:6, row:1, kind:'exc', level:'deployment / incident', mapped:'incident', effect:'prod', who:['oncall'], tag:'gen', map:false,
  desc:'The change is live and misbehaving. Either roll back, or ship a hotfix that returns it to released.',
  webhook:hook('deployment_status', `{ "action": "created", "deployment_status": { "state": "failure", "environment": "production" } }`),
  apis:[DEPLOY_STATUS('failure','production')]},
 {id:'ROLLED_BACK', raw:'previous deployment re-created · this one inactive', code:'ROLLED_BACK', short:'Reverted', col:6, row:2, kind:'ret', end:true, level:'deployment', mapped:'reverted', effect:'reverted', who:['oncall'], tag:'gen',
  desc:'Production runs the previous version again; this deployment becomes <code>inactive</code>. Usually a new work item follows.',
  apis:[DEPLOY('production')]},
 {id:'CANCELLED', raw:'issue: closed · state_reason not_planned', code:'CANCELLED', short:'Won\'t do', col:1, row:2, kind:'cancel', level:'issue', mapped:'cancelled', effect:'none', who:['pm'], tag:'gen',
  desc:'Dropped before shipping. Close any open PR too, or it lingers as an orphan.',
  webhook:hook('issues', `{ "action": "closed", "issue": { "number": 42, "state": "closed", "state_reason": "not_planned" } }`),
  apis:[CLOSE_NOT_PLANNED]}
],
edges:[
 {from:'BACKLOG', to:'READY', label:'refined', why:'Product owner adds the "ready" label'},
 {from:'READY', to:'IN_PROGRESS', label:'picked', why:'Developer assigns themself / pushes a branch'},
 {from:'IN_PROGRESS', to:'IN_REVIEW', label:'PR', why:'Pull request opened and review requested'},
 {from:'IN_REVIEW', to:'MERGED', label:'merge', why:'Approved and required checks green'},
 {from:'MERGED', to:'STAGING', label:'deploy', why:'Pipeline deploys main to staging'},
 {from:'STAGING', to:'RELEASED', label:'promote', why:'QA passes; promote to production'},
 {from:'IN_PROGRESS', to:'BLOCKED', fo:-40, label:'blocked', why:'Dependency or question stops the work'},
 {from:'BLOCKED', to:'IN_PROGRESS', kind:'back', to_:-10, why:'Blocker resolved'},
 {from:'IN_REVIEW', to:'CHANGES', fo:-30, to_:-30, why:'Reviewer submits REQUEST_CHANGES'},
 {from:'CHANGES', to:'IN_PROGRESS', kind:'back', fs:'t', ts:'b', fo:30, to_:40, label:'rework', why:'Developer addresses review comments'},
 {from:'STAGING', to:'IN_PROGRESS', kind:'back', fs:'t', ts:'t', k:60, label:'QA failed', why:'Bug found on staging; fix on a new commit'},
 {from:'BACKLOG', to:'CANCELLED', kind:'cancel', fs:'b', ts:'l', k:120, label:'dropped', why:'Closed as not planned'},
 {from:'READY', to:'CANCELLED', kind:'cancel', why:'Deprioritised before anyone started'},
 {from:'IN_PROGRESS', to:'CANCELLED', kind:'cancel', fs:'b', ts:'r', fo:40, k:150, why:'Abandoned mid-way — close the draft PR too'},
 {from:'RELEASED', to:'INCIDENT', kind:'exc', fo:-30, to_:-30, label:'incident', why:'Errors or failed deployment in production'},
 {from:'INCIDENT', to:'ROLLED_BACK', kind:'ret', label:'rollback', why:'Previous version redeployed'},
 {from:'INCIDENT', to:'RELEASED', kind:'back', fo:30, to_:30, label:'hotfix', lx:24, why:'Hotfix deployed to production'}
],
outcomes:[
 {id:'ship', tone:'ok', label:'Shipped', path:['BACKLOG','READY','IN_PROGRESS','IN_REVIEW','MERGED','STAGING','RELEASED'], desc:'The happy path: three objects (issue, PR, deployment) each own part of it.'},
 {id:'rework', tone:'ok', label:'Shipped after review rework', path:['BACKLOG','READY','IN_PROGRESS','IN_REVIEW','CHANGES','IN_PROGRESS','IN_REVIEW','MERGED','STAGING','RELEASED'], desc:'Changes requested loops back to development; the PR stays open throughout.'},
 {id:'qa', tone:'ok', label:'QA failure on staging', path:['BACKLOG','READY','IN_PROGRESS','IN_REVIEW','MERGED','STAGING','IN_PROGRESS'], desc:'Merged code can still go back to development — "merged" is not a terminal state.'},
 {id:'cancel', tone:'cancel', label:'Cancelled', path:['BACKLOG','READY','CANCELLED'], desc:'Closed as <code>not_planned</code>; nothing reached production.'},
 {id:'rollback', tone:'ret', label:'Incident → rollback', path:['BACKLOG','READY','IN_PROGRESS','IN_REVIEW','MERGED','STAGING','RELEASED','INCIDENT','ROLLED_BACK'], desc:'Production runs the previous version; the item ends reverted.'}
],
basics:[
 {title:'Authenticate', tag:'gen', body:'<ul><li>Fine-grained personal access token or a GitHub App installation token</li><li>Send the version header so response shapes stay stable</li></ul>', code:HDRS, codeLabel:'Headers on every request'},
 {title:'Verify webhooks', tag:'gen', body:'<ul><li><code>X-Hub-Signature-256</code> = <code>sha256=</code> + hex HMAC-SHA256 of the raw body with the webhook secret</li><li>Compare in constant time before parsing</li><li>Deduplicate on <code>X-GitHub-Delivery</code></li></ul>'},
 {title:'Reconcile', tag:'gen', body:'<p>Webhooks can be missed. Periodically list issues and PRs with <code>since=&lt;last sync&gt;</code>, and redeliver failed hook deliveries from the hook\'s delivery log.</p>'},
 {title:'Rate limits', tag:'gen', body:'<p>Watch <code>x-ratelimit-remaining</code> / <code>x-ratelimit-reset</code>; secondary limits return 403 or 429 with <code>retry-after</code>.</p>'}
],
ui:{mapSub:'"Maps to" is the board column a team might derive from the raw signals.'},
sources:['Illustrative example bundled with the lifecycle-diagram skill — GitHub REST API from general knowledge, not checked against current docs.']
};
})();
