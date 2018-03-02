import sys
import json
import os

import bottle
from bottle import post, route, run, request
from collections import OrderedDict

counter = 0
# current_adj[project_id]['user_counters'][user_name]
#                        ['conflicts'] - [<query_id>_<row_id>] todo: TBD
#                        ['query_list'] - list of query id's
#                        ['records'][query_id]['user_complete'] - {user_name: True}
#                                             ['user_counters'] - {user_name: '1'}: Corresponds to which 0 indexed row
#                                                                   was the last one returned to the user
#                                             ['rows'][0]
#                                               - {matches, query{first, last, dob, id}, response{first, last, dob, id}
#
current_adj = {}
projects = OrderedDict()
default_required_adjudications = 2

#TODO: A new judgements.dat needs to be written out and reread. This routine
#is only for the legacy loading.
def loadJudgments(id_str, psv):
    global current_adj
    
    adj_obj = current_adj[id_str]
    lines = iter(psv.splitlines())
    users = {}
    for line in lines:
        row = line.split('|')
        query_id = row[0]
        response_id = row[1]
        user = row[2]
        match = (row[3] == 'true')
        #appendEntry(adj_obj['name'], match_pair, user, match, fatigue)
        if not adj_obj['records'].has_key(query_id):
            continue
        query = adj_obj['records'][query_id]
        fatigue = 0 #TODO: serialize this (and possibly integrate with legacy)
        for row in query['rows']:#this array might make this a bit expensive
            if row['response']['id'] == response_id:
                row['matches'].append([user, match, fatigue])
                if not users.has_key(user):
                    users[user] = {}
                users[user][query_id] = 1
                #print "match " + query_id
                break
    #need to fill out which ones are complete and set counters
    for user in users:
        for query in users[user]:
            query_obj = adj_obj['records'][query]
            counter = 0
            for row in query_obj['rows']:
                found = False
                for match in row['matches']:
                    if match[0]==user:
                        found = True
                        break
                if not found:
                    break
                counter += 1
            if counter == len(query_obj['rows']):
                query_obj['user_complete'][user] = True
            query_obj['user_counters'][user] = counter
        #now set the counter for the first unfilled query
        query_counter = 0
        for query in adj_obj['query_list']:
            query_obj = adj_obj['records'][query]
            if not query_obj['user_complete'].has_key(user):
                break
            if not query_obj['user_complete'][user]:
                break
            query_counter += 1
        adj_obj['user_counters'][user]=query_counter


def loadMatches(id_str, psv, name):
    global current_adj
    lines = iter(psv.splitlines())
    # this set of records is organized by query id and is the root of the structure
    records = {}
    # this sibling of the records is simply a list of ids contained in the records dictionary
    queries = []

    # Set Defaults
    def_priority = 2
    def_req_adjudicators = 2

    # this is the default headers for the pipe separated values - overridden by the file itself
    key_list = ['id', 'first', 'last', 'dob']
    for line in lines:
        if line.startswith('key='): # detects the syntax which sets ad hoc header names
            keys = line[4:]
            key_list = keys.split('|')
            continue

        # Parse the priority and required adjudicators for the query out of the settings file
        if "+" in line:
            pair = line.split('+')
            line = pair[0]
            settings = pair[1].split('|')
            priority = settings[0]
            req_adjudicators = settings[1]
        else:
            priority = def_priority
            req_adjudicators = def_req_adjudicators


        line = line.lstrip('[').rstrip(']')
        pair = line.split('][')
        row_obj = {}
        query_array = pair[0].split('|')
        response_array = pair[1].split('|')
        query = {}
        response = {}
        column = 0
        for key in key_list:
            query[key] = query_array[column]
            response[key] = response_array[column]
            column += 1
        row_obj = {'query': query, 'response': response, 'matches': [], 'priority': priority, 'req_adjudicators': req_adjudicators }
        query_id = row_obj['query']['id']
        if not records.has_key(query_id):
            # So this is a new query, never seen before. Add it to the list of query ids.
            queries.append(query_id)
            records[query_id] = {}
            records[query_id]['user_counters'] = {}
            records[query_id]['rows'] = []
            records[query_id]['user_complete'] = {}
        records[query_id]['rows'].append(row_obj)

    current_adj[id_str] = {'name': name, 'records': records, 'query_list': queries, 'user_counters': {}, 'conflicts': []}
    print "loaded queries: " + str(len(queries)) + " into " + id_str


def loadProjects():
    global projects
    projects_file = "imac_data/Projects.dat"

    # check to make sure the projects file exists
    if not os.path.isfile(projects_file):
        return

    # open file, split it into lines
    with open(projects_file, "r") as myfile:
        psv = myfile.read()
    lines = iter(psv.splitlines())

    # define known column headers for file
    key_list = ['id', 'name']
    for line in lines:
        project_info = {}
        column = 0
        # split psv into array by pipe
        project_array = line.split('|')

        # for each known key, add the key and value to a temporary project_info dictionary
        for key in key_list:
            project_info[key] = project_array[column]
            column += 1

        # permanently store the project_info dictionary into our global projects dictionary
        projects[project_info['id']] = project_info


def safeReadFile(file_path):
    if not os.path.isfile(file_path):
        return False
    with open(file_path, "r") as myfile:
        return myfile.read()


def appendEntry(name, matchpair, user, entry, fatigue):
    print name
    s_entry = str(entry)
    s_fatigue = str(fatigue)
    print matchpair['query']['id'] + "|" + str(matchpair['response']['id']) + "|" +  str(user) + "|" + s_entry + "|" + s_fatigue


@post('/project/edit/<id_str>')
def editProject(id_str):
    project_data = request.forms.get

    if id_str == 'new':
        db.projects.insert_one(project_data)
    else:
        db.projects.update_one({"__id": id_str}, {"$set": project_data})



@route('/incomplete/<user>/<id_str>')
def getIncomplete(user, id_str):
    global current_adj
    adj_obj = current_adj[id_str]

    # Get Current Query for this user
    current_query_counter = adj_obj['user_counters'][user]
    current_query_id = adj_obj['query_list'][current_query_counter]
    current_query = adj_obj['records'][current_query_id]

    # Figure out which, if any, rows this user hasn't adjudicated yet
    user_complete = True
    row_count = 0
    for row in current_query['rows']:
        if not hasAdjudicated(user, row['matches']):
            # Find the first unajudicated row and reset the user_counter for this query
            user_complete = False
            current_query['user_counters'][user] = row_count
            break

    if user_complete:
        current_query_counter += 1
        current_query['user_complete'][user] = True
        adj_obj['user_counters'][user] = current_query_counter
        return getIncomplete(user, id_str)
    else:
        return getNext(user, id_str)


def hasAdjudicated(user, matches):
    for match in matches:
        if match[0] == user:
            return True
    return False


@route('/next/<user>/<id_str>')
def getNext(user, id_str):
    global current_adj
    adj_obj = current_adj[id_str]

    # check to see if this is the first time we've heard from this user
    # todo: we're currently only storing this user_counter in memory, we probably want to write this out to the users.dat file
    if not adj_obj['user_counters'].has_key(user):
        adj_obj['user_counters'][user] = 0;

    # Grabs from the user_counters dictionary which query we're currently on
    current_query_counter = adj_obj['user_counters'][user];
    # Grabs the id of the current query based on the user's query counter
    current_query_id = adj_obj['query_list'][current_query_counter];
    # Grabs all of the matches for a single query
    current_query = adj_obj['records'][current_query_id]

    if current_query_counter >=  len (current_query['rows']):
        return {}

    # the set mark function is in charge of progressing the user to the next query
    # adj_obj['user_counters'][user] += 1;

    if not current_query['user_counters'].has_key(user):
        current_query['user_counters'][user] = 0;

    counter = current_query['user_counters'][user]
    if counter >=  len (current_query['rows']):
        return {'query_id': current_query_id}

    match = current_query['rows'][counter]
    current_query['user_counters'][user] = counter + 1

    # If this row has already been adjudicated by this user get the next one
    if hasAdjudicated(user, match['matches']):
        return getNext(user, id_str)


    return {'match_id': counter, 'match': match, 'query_id': current_query_id}
    # TODO return number of remaining responses for query
    # 'query_total': query_responses}


@route('/mark/<user>/<id_str>/<match_id>/<match>/<fatigue>')
def setMark(user, id_str, match_id, match, fatigue):
    global current_adj
    adj_obj = current_adj[id_str]

    current_query_counter = adj_obj['user_counters'][user]
    current_query_id = adj_obj['query_list'][current_query_counter]
    current_query = adj_obj['records'][current_query_id]

    # sets the marking in memory
    match_pair = current_query['rows'][int(match_id)]
    match = match == 'true'
    fatigue = fatigue == 'true'
    match_pair['matches'].append([user, match, fatigue])
    
    # writes it out to disk
    appendEntry(adj_obj['name'], match_pair, user, match, fatigue)

    # check if we've already marked this match_pair as a conflict
    conflict_id = current_query_id + '_' + match_id
    if conflict_id not in adj_obj['conflicts']:
        # check all matches for conflict
        true_count = 0
        false_count = 0
        for match in match_pair['matches']:
            if match[1]:
                true_count += 1
            else:
                false_count += 1
        if true_count > 0 and false_count > 0:
            adj_obj['conflicts'].append(conflict_id)


    # Advance the query counter for this user, if they've adjudicated this query
    user_complete = True
    for row in current_query['rows']:
        if not hasAdjudicated(user, row['matches']):
            user_complete = False
            break

    if user_complete:
        current_query_counter += 1
        current_query['user_complete'][user] = True
        adj_obj['user_counters'][user] = current_query_counter


@route('/status')
def getStatus():
    global counter
    return { 
        'python': sys.version, 
        'bottle_version': bottle.__version__ , 
        'open': counter
    };


# Gets the info for all current adjudication projects
@route('/info')
def getInfoAll():
    global current_adj
    listing = []
    for id_str in current_adj:
        adj_obj = current_adj[id_str]

        # Count the total number of completed adjudications
        total_adjudications = 0
        for user_name, value in adj_obj['user_counters'].iteritems():
            #todo: we can't use these user_counter values. They're the count of completed queries not adjudications
            total_adjudications += value

        # Count the total number of required adjudications
        required_adjudications = 0
        for query in adj_obj['query_list']:
            required_adjudications += default_required_adjudications


        project = ({
            'id': id_str,
            'name': adj_obj['name'],
            'queries': len(adj_obj['query_list']),
            'users': adj_obj['user_counters']
        })

        if required_adjudications > 0:
            project.update({
                'total_adjudications': total_adjudications,
                'required_adjudications': required_adjudications,
                'percent_complete': "{:.0%}".format(total_adjudications / required_adjudications * 100),
                'conflicts': len(adj_obj['conflicts'])
            })

        listing.append(project)
    return {'projects': listing}


@route('/info/<id_str>')
def getInfo(id_str):
    global current_adj
    fields = []
    if current_adj.has_key(id_str):
        adj_obj = current_adj[id_str]
        if 'rows' in adj_obj['records'].itervalues().next():
            for field in adj_obj['records'].itervalues().next()['rows'][0]['query'].iterkeys():
                fields.append(field)
        return {
            'id': id_str,
            'name': adj_obj['name'],
            'queries': len(adj_obj['query_list']),
            'query_list': adj_obj['query_list'],
            'users': adj_obj['user_counters'],
            'fields': fields
        }
    else:
        return {}


@post('/load/<name>')
def loadAdjudications(name):
    global counter
    csv = request.body.read()
    counter = counter + 1
    loadMatches(str(counter), csv, name)
    return str(counter)


@post('/result/<id_str>')
def getResults(id_str):
    global current_adj
#    agent = request.body.read();
#    if not agent:
#        return "Must sign with adjudicator name"
    records = current_adj[id_str]
    return records


@route('/import/<id_str>')
def importRun(id_str):
    # check for existing file
    file_path = "imac_data/q" + id_str + ".dat"
    # todo: read post data for file lines

    if not os.path.isfile(file_path):
        myfile = open(file_path, "w+")
        # Validate that the run we're importing has the same columns as the existing run
        # todo: validation
    else:
        myfile = open(file_path, "w+")

    myfile.close()

    return {'message': 'Oh man, at least we did something.'}


# TODO put into main and check params for port etc
# The following automatically loads the existing data exported for imac
counter = 1
default_questions = safeReadFile("imac_data/Questions.dat")
default_judgements = safeReadFile("imac_data/Judgments.dat")

loadMatches('1', default_questions, 'default')
loadJudgments('1', default_judgements)

loadProjects()

for id, project in projects.iteritems():
    id_str = str(id)
    questions = safeReadFile("imac_data/q" + id_str + ".dat")
    judgements = safeReadFile("imac_data/j" + id_str + ".dat")

    loadMatches(id_str, questions, project['name'])
    loadJudgments(id_str, judgements)


run(host='localhost', port=8080);
