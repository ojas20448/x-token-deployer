import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { useState } from 'react';
import { getChallenge, verifySignature } from './api';

function App() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [twitterHandle, setTwitterHandle] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [linkedData, setLinkedData] = useState<{ twitterId: string; walletAddress: string } | null>(null);

  const handleLink = async () => {
    if (!address || !twitterHandle) return;
    setStatus('signing');
    setErrorMsg('');

    try {
      // 1. Get Challenge (SIWE)
      // Note: We use the handle as the ID for now in this mock flow
      const twitterId = twitterHandle.replace('@', '');
      const { message } = await getChallenge(twitterId, address);

      // 2. Sign Message
      const signature = await signMessageAsync({ message });

      setStatus('verifying');

      // 3. Verify
      const result = await verifySignature(message, signature, twitterId);

      if (result.success) {
        setStatus('success');
        setLinkedData(result);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Failed to link wallet. Check console.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-900">

      <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2 text-center">
          X Deploy Bot
        </h1>
        <p className="text-slate-400 text-center mb-8">Link your wallet to enable deployments</p>

        <div className="flex justify-center mb-8">
          <ConnectButton />
        </div>

        {!isConnected && (
          <div className="text-center text-slate-500 text-sm">
            Connect your wallet to proceed
          </div>
        )}

        {isConnected && status !== 'success' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">X Username</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500">@</span>
                <input
                  type="text"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  placeholder="elonmusk"
                  className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-8 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleLink}
              disabled={!twitterHandle || status === 'signing' || status === 'verifying'}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              {status === 'signing' && 'Check Wallet...'}
              {status === 'verifying' && 'Verifying...'}
              {status === 'idle' && 'Sign & Link'}
              {status === 'error' && 'Try Again'}
            </button>

            {status === 'error' && <p className="text-red-400 text-sm text-center">{errorMsg}</p>}
          </div>
        )}

        {status === 'success' && linkedData && (
          <div className="text-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400 text-2xl border border-green-500/30">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Successfully Linked!</h3>
              <p className="text-slate-400 text-sm mt-1">
                <span className="text-blue-400">@{linkedData.twitterId}</span> is now linked to <span className="text-yellow-400">{linkedData.walletAddress.slice(0, 6)}...{linkedData.walletAddress.slice(-4)}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-slate-600 text-sm">
        Built for Base Sepolia
      </div>
    </div>
  )
}

export default App
