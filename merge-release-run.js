#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const bent = require('bent')
const git = require('simple-git')()
const { execSync } = require('child_process')
const { promisify } = require('util')

const getlog = promisify(git.log.bind(git))

const get = bent('json', 'https://registry.npmjs.org/')

const event = JSON.parse(fs.readFileSync('/github/workflow/event.json').toString())

let pkg = require(path.join(process.cwd(), 'package.json'))

const run = async () => {
  let latest
  try {
    latest = await get(pkg.name + '/latest')
  } catch (e) {
    // unpublished
  }

  let messages

  if (latest) {
    if (latest.gitHead === process.env.GITHUB_SHA) return console.log('SHA matches latest release, skipping.')
    if (latest.gitHead) {
      let logs = await getlog({ from: latest.gitHead, to: process.env.GITHUB_SHA })
      messages = logs.all.map(r => r.message + '\n' + r.body)
      // g.log({from: 'f0002b6c9710f818b9385aafeb1bde994fe3b370', to: '53a92ca2d1ea3c55977f44d93e48e31e37d0bc69'}, (err, l) => console.log(l.all.map(r => r.message + '\n' + r.body)))
    } else {
      latest = null
    }
  }
  if (!latest) {
    messages = event.commits.map(commit => commit.message + '\n' + commit.body)
  }

  let version = 'patch'
  if (messages.map(message => message.includes('BREAKING CHANGE')).includes(true)) {
    version = 'major'
  } else if (messages.map(message => message.toLowerCase().startsWith('feat')).includes(true)) {
    version = 'minor'
  }

  let current = execSync(`npm view ${pkg.name} version`).toString()
  process.stdout.write(execSync(`npm version --allow-same-version=true --git-tag-version=false ${current} `))
  let newVersion = execSync(`npm version --git-tag-version=false ${version}`).toString()
  console.log(newVersion)
  process.stdout.write(execSync(`npm publish --access=public`))
  process.stdout.write(execSync(`git checkout package.json`))
}
run().catch(console.error)
