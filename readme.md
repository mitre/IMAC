# IMAC Ground Truth Adjudication Tool

## INSTALLING SYSTEM PREREQUISITES
1. Download and Install Node ~v4.5.0 (tested with v6.9.2)
    * https://nodejs.org/en/download/
2. Download and Install Mongodb ~v3.2.9 (tested with 3.4.2)
    * https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/

## GETTING THE SOURCE
1. git clone https://github.com/mitre/IMAC && cd /imac

## INSTALLING PACKAGE DEPS w/ NPM
1. npm update

## RUNNING
1. Start mongodb (configuring it as a service/daemon/etc. is recommended):
    * `$ mongod --dbpath <IMAC extraction dir>/imac/data/`
2. npm start
 
## FIRST USE
Once you’ve got the site up and running there are three steps between you and having a project ready to adjudicate:
1. Create the first admin account (you’re prompted to as soon as you hit http://localhost:3000)
2. Log in as that admin account and create a new project (user name `admin`, use the password created in step 1)
    * When it’s first created a new project is ‘pending’ and invisible to normal users.
3. Import a new run of potential matches to that project
4. From that project’s settings page drag/drop fields to create a new layout
    * At this point the project will become visible to normal users
 
From there normal users can create accounts, log in, and adjudicate on that project you’ve created. Those new users accounts can be turned into admin accounts via the ‘manage users’ feature (in the hamburger menu on the top right).
 
## Glossary
* `Query`: The total set of a record and all its `Potential Matches`.
* `Potential Matches`: The set of records that may or may not be a match to the `Query` record.
* `Judgement`: A single user's adjudication on a single `Potential Match`.
* `Adjudication Set`: The set of a single user's adjudications on all `Potential Matches` for a single `Query`.
* `Required Adjudications`: Set by the admin, this is the number of times a given `Query` must be adjudicated before it will be considered fully adjudicated (a.k.a. the number of complete `Adjudication Sets` that must exist for that given `Query`)

## IMPORTING DATA
Format for adjudication files:
1.  Square brackets ('[', ']') go around around each record
2.  The first record in a line is the `Query` the second record is the `Potential Match`
3.  Pipe '|' characters delimit fields
4.  The header row describes the fields and begins with 'key='
5.  The '~' character delimits fields with multiple entries (see the 'children' field in the first two lines below)
6.  Special characters that exist in the data can be escaped with a slash (e.g. '\~' or '\|')
7.  Each record must have the same number of fields as exist in the header (see Michelle Cook, below, who has no children, but the final field is delimited with a trailing '|')
 
`key=record_id|first_name|last_name|gender|date_of_birth|street|city|state|zip|children
[1000|Richard|James|male|1936-06-21|8\~ Thierer Pass|Shasta Lake|ID|87850|Margo~Richard Jr.~Saul][11000|R.|James|male|1936-06-21|8 Thierer Pass|Shasta\| Lake|ID|87850|Margo~Richard Jr.~Sam]
[1000|Richard|James|male|1936-06-21|8 Thierer Pass|Shasta Lake|ID|87850|Margo~Richard Jr.~Saul][11001|Richard|Jmaes|male|1936-06-21|8 Thierer Pass|Shasta Lake|ID|87850|Margo~Richard Jr.]
[1001|Michelle|Cook|female|1934-04-05|15 Cody Parkway|Tehama|NH|16466|][11002|Michelle|Cook|female|1934-05-04|15 Cody Parkway|Tehama|NH|16466|]
[1001|Michelle|Cook|female|1934-04-05|15 Cody Parkway|Tehama|NH|16466|][11003|M.|Cook|female|1934-04-05|15 Cody Parkway|Tehama|NH|16466|]`
 

## PROJECT STATISTICS

* `% Complete`: `Complete Judgements` / (`Complete Judgements` + `Remaining Judgements`)
* `Complete Judgements`: The sum of all judgements in all 'complete' `Adjudications Sets`.
* `Remaining Judgements`: The sum of all judgements in all non 'complete' `Adjudication Sets`.
* `Complete Adjudication Sets`: An `Adjudication Set` is considered 'complete' once a single user has adjudicated every potential match for the query.
* `Remaining Adjudication Sets`: The number of required `Adjudication Sets` minus the number of `Complete Adjudication Sets`. 

Note: `Remaining Judgements` and `Remaining Adjudication Sets` will be negative if users have exceeded the number of `Required Adjudication Sets` for a single query.

