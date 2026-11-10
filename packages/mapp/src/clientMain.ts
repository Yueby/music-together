import './cspValidation.ts'
import './client.css'
import { startMappClient } from './bootstrapClient.ts'

const client = startMappClient({
  endpoint: __MAPP_ROOM_ENDPOINT__,
  reviewedEndpointUrl: __MAPP_ROOM_URL__,
})
void client.ready.catch(() => {})
