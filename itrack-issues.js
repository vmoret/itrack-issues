// Name:            itrack-issues
// Version:         0.2
// Description:
//      Vue.js component that queries the itrack field issues linked to a
//      given Customer (based on System Name), builds a table view of this
//      and attaches this view to a given DOM element.
// Author:          Vincent Moret
// Maintainer:      vincent.moret@barco.com
// History:
//      0.1         Initial version
//      0.2         Made columns (a.k.a. fields) configurable + moved to ES6

(function() {

const itrackBase = 'https://itrack.barco.com';

const template = `<div class="itrack">
<ul>
    <li v-on:click="exclCR = !exclCR">{{ printExclIncl(exclCR) }} change-requests</li>
    <li v-on:click="exclClosed = !exclClosed">{{ printExclIncl(exclClosed) }} closed</li>
</ul>
<table class="list" rules="all" cellspacing="0" border="1" style="width:100%;border-collapse:collapse;">
    <tr class="header">
        <td>Key</td>
        <td v-for="field in fields_">{{ field[2] }}</td>
    </tr>
    <tr v-for="issue in filteredIssues">
        <td>
            <img v-bind:src="issue.fields.issuetype.iconUrl" title="issue.fields.issuetype.name"/>
            <a v-bind:href="buildIssueUrl(issue)" target="_blank">{{ issue.key }}</a>
        </td>
        <td v-for="field in fields_" v-bind:style="fieldStyle(issue, field[0])">
            {{ field[1](issue) }}
        </td>
    </tr>
</table>
</div>`;

const compose = (a, b) => c => a(b(c));
    
const httpGet = (url, callback) => {
	const xhttp = new XMLHttpRequest();
  	xhttp.onreadystatechange = function () {
    	if (this.readyState == 4) {
          	if (this.status == 200) {
            	callback(
                	JSON.parse(this.responseText),
                  	null
                );
            } else {
              	callback(
                	null,
                  	'Failed to load issues from iTrack'
                );
            }
        }
    };
  	xhttp.open('GET', url, false);
  	xhttp.setRequestHeader('Content-Type', 'application/json');
  	xhttp.send();
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", 
                    "Sep", "Oct", "Nov", "Dec"];
const parseDate = datestring => new Date(Date.parse(datestring));
const formatDate = date =>
    date.getDate() + '/' + monthNames[date.getMonth()] + '/' + date.getFullYear();    
const parseAndFormatDate = compose(formatDate, parseDate);

const parseField = name => issue => issue.fields[name];
const parseFieldValue = name => compose(x => x.name, parseField(name));
const parseCustomFieldValue = name => compose(x => x.value, parseField(name));
    
const fieldMappings = {
    summary: ['summary', parseField('summary')],
    project: ['project', parseFieldValue('project')],
    status: ['status', parseFieldValue('status')],
    severity: ['customfield_10002', parseCustomFieldValue('customfield_10002')],
    customer: ['customfield_10090', parseField('customfield_10090')],
    created: ['created', compose(parseAndFormatDate, parseField('created'))]
};

const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

const parseFields = fields => fields.split(',').filter(
    x => x in fieldMappings).map(x => fieldMappings[x].concat([capitalize(x)]));

const buildUrl = ({apiBase, jql, fields, maxResults}) => 
    apiBase + '?jql=' + jql + '&maxResults=' + maxResults + 
    '&fields=issuetype,status,' + parseFields(fields).map(xs => xs[0]).join(',');
    
function buildIssueStatusStyle(issue) {
    var status = issue.fields.status.name;
    if (status === 'Closed') {
        return 'background-color: green; color: white;';
    } else if (status == 'Verified' || status == 'Resolved') {
        return 'background-color: yellow; color: black;';
    } else {
        return '';
    }
}

function buildIssueSeverityStyle(issue) {
    var severity = issue.fields.customfield_10002.value;
    if (severity == 'S1 - Major') {
        return 'background-color: red; color: white;';
    } else if (severity == 'S2 - High') {
        return 'background-color: orange; color: white;';
    } else {
        return '';
    }
}
    
const props = {
    apiBase: {
        type: String,
        required: true
    },
    jql: {
        type: String,
        required: true
    },
    fields: {
        type: String,
        default: 'summary'
    },
    maxResults: {
        type: Number,
        default: 150
    }
};

const computed = {
    fields_() {
        return parseFields(this.fields);
    },
    filteredIssues() {
        const exclCR = this.exclCR,
              exclClosed = this.exclClosed,
              isDefect = issue => issue.fields.issuetype.name.indexOf('defect') !== -1,
              isClosed = issue => issue.fields.status.name === 'Closed';
        return this.issues.filter(function (issue) {
            var defect = isDefect(issue),
                closed = isClosed(issue);
            if (exclCR) {
                if (!defect) {
                    return false;
                }
            }
            if (exclClosed) {
                if (closed) {
                    return false;
                }
            }
            return true;
        });
    }
};

const methods = {
    printExclIncl(excl) {
        return excl ? 'Include' : 'Exclude';
    },
    buildIssueUrl(issue) {
        return itrackBase + '/browse/' + issue.key;
    },
    fieldStyle(issue, field) {
        return field === 'status' 
            ? buildIssueStatusStyle(issue)
            : field === 'customfield_10002'
                ? buildIssueSeverityStyle(issue)
                : '';
    }
};

function bindData(el) {
    httpGet(buildUrl(el), (data, err) => {
        if (err !== null) {
            el.error = err;
            return;
        }
        el.issues = data.issues;
    });
};

Vue.component('itrack-issues', {
    props,
    template,
    mounted() {
        bindData(this);
    },
    data() {
        return {
            error: '',
            issues: [],
            exclCR: true,
            exclClosed: true
        };
    },
    computed,
    methods
});
    
}());