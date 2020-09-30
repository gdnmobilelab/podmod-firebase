import { Request } from "restify"
export interface IAPVerifiedRequest extends Request {
  auth?: {
    verifiedEmail?: string,
    verifiedSub?: string,
    requestedEmail?: string,      
  }
}