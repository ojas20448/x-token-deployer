import axios from 'axios';

const API_URL = 'http://localhost:3000/api/link';

export const api = axios.create({ baseURL: API_URL });

export const getStatus = async (twitterId: string) => {
    const res = await api.get(`/status/${twitterId}`);
    return res.data;
};

export const getChallenge = async (twitterId: string, address: string) => {
    const res = await api.post('/challenge', { twitterId, address });
    return res.data; // { message, nonce }
};

export const verifySignature = async (message: string, signature: string, twitterId: string) => {
    const res = await api.post('/verify', { message, signature, twitterId });
    return res.data;
};
