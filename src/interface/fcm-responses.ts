// {
//   "error": {
//     "code": 400,
//     "message": "Invalid JSON payload received. Unknown name \"expiration_time\": Cannot find field.",
//     "status": "INVALID_ARGUMENT",
//     "details": [
//       {
//         "@type": "type.googleapis.com/google.rpc.BadRequest",
//         "fieldViolations": [
//           {
//             "description": "Invalid JSON payload received. Unknown name \"expiration_time\": Cannot find field."
//           }
//         ]
//       }
//     ]
//   }
// }

export interface FCMError {
  code: number;
  message: string;
  status: string;
  details: any[];
}

export interface FCMWebRegistrationResponse {
  error?: FCMError;
  token?: string;
}

interface FCMiOSRegistrationResponse {
  status: string;
  registration_token?: string;
  apns_token: string;
}

export interface FCMiOSBatchRegistrationResponse {
  error?: FCMError;
  results?: FCMiOSRegistrationResponse[];
}

// {
// 	"error": "InvalidToken"
// }

export interface FCMTopicSubscribeResponse {
  error?: string;
}
export interface FCMSendMessageResponse {
  name?: string;
  error?: FCMError;
}
