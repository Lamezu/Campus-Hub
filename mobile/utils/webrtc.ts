export const webRTCAvailable = true;
export const RTCPeerConnection: any = class { };
export const RTCSessionDescription: any = class { };
export const RTCIceCandidate: any = class { };
export const mediaDevices: any = {
    getUserMedia: async () => ({
        getTracks: () => [],
        getAudioTracks: () => [],
        getVideoTracks: () => [],
    }),
};
export const RTCView: any = () => null;
export const MediaStream: any = class { };

