// Name:            itrack-issues
// Version:         0.1
// Description:
//      Vue.js component that queries the itrack field issues linked to a
//      given Customer (based on System Name), builds a table view of this
//      and attaches this view to a given DOM element.
// Author:          Vincent Moret
// Maintainer:      vincent.moret@barco.com
// History:
//      0.1         Initial version

(function() {
    'use strict';
    
    var fields = 'summary,project,status,issuetype,customfield_10002,created';
    
    function httpGet(url, callback) {
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function onresponse() {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    var data = JSON.parse(this.responseText);
                    callback(data, null);
                } else {
                    callback(null, 'Failed to load issues from iTrack');
                }
            }
        };
        xhttp.open("GET", url, false);
        xhttp.setRequestHeader("Content-Type", "application/json");
        xhttp.send();
    }
    
    function formatDate(date) {
        var monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
            "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        var day = date.getDate();
        var monthIndex = date.getMonth();
        var year = date.getFullYear();

        return day + '/' + monthNames[monthIndex] + '/' + year;
    }
    
    function buildUrl(apiBase, jql, maxResults) {
        return apiBase + '?jql=' + jql + '&maxResults=' + maxResults + 
            '&fields=' + fields;
    }
    
    Vue.component('itrack-issues', {
        props: {
            jql: {
                type: String,
                required: true
            },
            apiBase: {
                type: String,
                required: true
            },
            maxResults: {
                type: Number,
                default: 150
            }
        },
        template: '<div class="itrack">' +
            '<ul>' +
            '<li v-on:click="exclCR = !exclCR">{{ printExclIncl(exclCR) }} change-requests</li>' +
            '<li v-on:click="exclClosed = !exclClosed">{{ printExclIncl(exclClosed) }} closed</li>' +
            '</ul>' +
            '<table class="list" rules="all" cellspacing="0" border="1" style="width:100%;border-collapse:collapse;">' +
            '<tr class="header">' + 
            '<td>Key</td>' +
            '<td>Summary</td>' +
            '<td>Status</td>' +
            '<td>Project</td>' +
            '<td>Severity</td>' +
            '<td>Created</td>' +
            '</tr>' +
            '<tr v-for="issue in filteredIssues">' +
            '<td><img v-bind:src="issue.fields.issuetype.iconUrl" title="issue.fields.issuetype.name"/>' +
            '<a v-bind:href="buildIssueUrl(issue)" target="_blank">{{ issue.key }}</a></td>' +
            '<td>{{ issue.fields.summary }}</td>' +
            '<td v-bind:style="buildIssueStatusStyle(issue)">{{ issue.fields.status.name }}</td>' +
            '<td>{{ issue.fields.project.name }}</td>' +
            '<td v-bind:style="buildIssueSeverityStyle(issue)">{{ issue.fields.customfield_10002.value }}</td>' +
            '<td>{{ formatDate(issue.fields.created) }}</td>' +
            '</tr>' +
            '</table>' +
            '</div>',
        mounted: function () {
            httpGet(buildUrl(this.apiBase, this.jql, this.maxResults), function (data, err) {
                if (err !== null) {
                    this.error = err;
                    return;
                }
                this.issues = data.issues;
            }.bind(this))
        },
        data: function () {
            return {
                error: '',
                issues: [],
                exclCR: true,
                exclClosed: true
            };
        },
        computed: {
            filteredIssues: function() {
                var exclCR = this.exclCR,
                    exclClosed = this.exclClosed;
                function isDefect(issue) {
                    return issue.fields.issuetype.name.indexOf('defect') !== -1;
                }
                function isClosed(issue) {
                    return issue.fields.status.name === 'Closed';
                }
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
        },
        methods: {
            formatDate: function(datestring) {
                return formatDate(new Date(Date.parse(datestring)));
            },
            printExclIncl: function (excl) {
                return excl ? 'Include' : 'Exclude';
            },
            buildIssueUrl: function (issue) {
                return 'https://itrack.barco.com/browse/' + issue.key;
            },
            buildIssueStatusStyle: function (issue) {
                var status = issue.fields.status.name;
                if (status === 'Closed') {
                    return 'background-color: green; color: white;';
                } else if (status == 'Verified' || status == 'Resolved') {
                    return 'background-color: yellow; color: black;';
                } else {
                    return '';
                }
            },
            buildIssueSeverityStyle: function (issue) {
                var severity = issue.fields.customfield_10002.value;
                if (severity == 'S1 - Major') {
                    return 'background-color: red; color: white;';
                } else if (severity == 'S2 - High') {
                    return 'background-color: orange; color: white;';
                } else {
                    return '';
                }
            }
        }
    });
    
}());