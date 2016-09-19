
export interface iOSSubscription {
    device_id: string;
    bundle_name: string;
}

export interface WebSubscription {
    endpoint:string;
    keys: {
        p256dh: string,
        auth: string
    }
}