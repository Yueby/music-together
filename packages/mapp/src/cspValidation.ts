import { config } from 'zod/v4'

// The micro-app sandbox disallows dynamic code generation, including JIT probes.
config({ jitless: true })
