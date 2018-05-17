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
//      0.3         Split up different sub-components + made filter live

(function() {

    const itrackBase = 'https://itrack.barco.com';

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

    // ------------------------------------------------------------------------
    // toggle-item
    // ------------------------------------------------------------------------
    
    const toggleItem = {
        props: ['options'],
        computed: {
            value() {
                return this.options.selected;
            }
        },
        methods: {
            onclick() {
                const evt = {
                    $id: this.options.$id, 
                    $value: !this.value
                };
                this.$emit('toggle-change', evt);
            }
        },
        template: `<li v-on:click.prevent="onclick()">{{ value ? options.unselectedText : options.selectedText }}</li>`
    };

    // ------------------------------------------------------------------------
    // issue-filter
    // ------------------------------------------------------------------------
    
    const issueFilter = {
        components: {
            toggleItem
        },
        mounted() {
            this.transformEmit({$id: null});
        },
        computed: {
            jql() {
                const jql = ({selected, selectedJql, unselectedJql}) => selected ? unselectedJql : selectedJql;
                return this.items.map(jql).filter(s => s.length !== 0).join(' and ');
            }
        },
        methods: {
            transformEmit(evt) {
                this.items = this.items.map(item => item.$id === evt.$id ? Object.assign({}, item, {selected: evt.$value}) : item)
                const newEvent = Object.assign({}, evt, {$jql: this.jql});
                this.$emit('filter-change', newEvent);
            }
        },
        data() {
            return {
                items: [{
                    $id: 'change-requests',
                    selected: false,
                    selectedText: 'Include change-requests',
                    unselectedText: 'Exclude change-requests',
                    selectedJql: '(issuetype in ("Software defect", "Hardware defect", "Process defect", "Documentation defect"))',
                    unselectedJql: ''
                }, {
                    $id: 'closed',
                    selected: false,
                    selectedText: 'Include closed',
                    unselectedText: 'Exclude closed',
                    selectedJql: '(status != "Closed")',
                    unselectedJql: ''
                }]
            };
        },
        template: `<ul>
            <toggle-item v-for="item in items" v-on:toggle-change="transformEmit($event)" 
                v-bind:options="item"></toggle-item>
        </ul>`
    };
    
    // ------------------------------------------------------------------------
    // issue-table
    // ------------------------------------------------------------------------

    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

    const issueTable = {
        props: ["issues", "fields"],
        methods: {
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
        },
        template: `<table class="list" rules="all" cellspacing="0" border="1" style="width:100%;border-collapse:collapse;">
    <tr class="header">
        <td>Key</td>
        <td v-for="field in fields">{{ field[2] }}</td>
    </tr>
    <tr v-for="issue in issues">
        <td>
            <img v-bind:src="issue.fields.issuetype.iconUrl" title="issue.fields.issuetype.name"/>
            <a v-bind:href="buildIssueUrl(issue)" target="_blank">{{ issue.key }}</a>
        </td>
        <td v-for="field in fields" v-bind:style="fieldStyle(issue, field[0])">
            {{ field[1](issue) }}
        </td>
    </tr>
</table>`
    };
    
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

    // ------------------------------------------------------------------------
    // itrack-issues
    // ------------------------------------------------------------------------

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", 
                        "Sep", "Oct", "Nov", "Dec"];
    // HACK: IE11 `Date.parse` doesn't handle timezones properly --> remove them.
    const parseDate = datestring => new Date(Date.parse(datestring.split('+')[0]));
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
    
    const itrackIssues = {
        components: {
            issueFilter,
            issueTable
        },
        props: {
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
        },
        data() {
            return {
                error: '',
                filter: '',
                issues: []
            };
        },
        methods: {
            onchange(evt) {
                this.filter = evt.$jql;
                httpGet(this.url, (data, err) => {
                    if (err !== null) {
                        this.error = err;
                        return;
                    }
                    this.issues = data.issues;
                });
            }
        },
        computed: {
            url() {
                const jql = this.filter.length !== 0 ? this.filter + ' and ' + this.jql : this.jql;
                return this.apiBase + '?jql=' + jql + '&maxResults=' + 
                    this.maxResults + '&fields=issuetype,status,' + 
                    this.fieldList.map(xs => xs[0]).join(',');
            },
            fieldList() {
                return this.fields.split(',').filter(x => x in fieldMappings).map(x => fieldMappings[x].concat([capitalize(x)]))
            }
        },
        template: `<div class="itrack">
            <div class="error" v-if="error.length !== 0">{{ error }}</div>
            <issue-filter v-on:filter-change="onchange($event)"></issue-filter>
            <issue-table v-bind:issues="issues" v-bind:fields="fieldList"></issue-table>
        </div>`
    };

    Vue.component('itrack-issues', itrackIssues);
    
}());