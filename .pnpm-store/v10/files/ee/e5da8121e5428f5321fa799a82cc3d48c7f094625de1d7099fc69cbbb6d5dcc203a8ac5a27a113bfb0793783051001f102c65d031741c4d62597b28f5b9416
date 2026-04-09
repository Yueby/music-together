'use strict'

const childProcess = require('child_process')

function shellExec (cmd = '', opts = {}) {
  if (Array.isArray(cmd)) {
    cmd = cmd.join(';')
  }

  opts = Object.assign({ stdio: 'pipe', cwd: process.cwd() }, opts)

  let child
  const shell = process.platform === 'win32' ? { cmd: 'cmd', arg: '/C' } : { cmd: 'sh', arg: '-c' }

  try {
    child = childProcess.spawn(shell.cmd, [shell.arg, cmd], opts)
  } catch (error) {
    return Promise.reject(error)
  }

  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data
      })
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data
      })
    }

    child.on('error', error => {
      resolve({ error, stdout, stderr, cmd })
    })

    child.on('close', code => {
      resolve({ stdout, stderr, cmd, code })
    })
  })
}

module.exports = shellExec
