"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
} from "../lib/contract";

// Sepolia chain id as hex, used for wallet_switchEthereumChain
const SEPOLIA_HEX = "0xaa36a7";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type Batch = {
  id: bigint;
  produceType: string;
  quantityKg: bigint;
  farmer: string;
  ipfsHash: string;
  timestamp: bigint;
  status: string;
  delivered: boolean;
};

type HistoryItem = {
  status: string;
  updatedBy: string;
  timestamp: bigint;
};

export default function Home() {
  const [account, setAccount] = useState("");
  const [onCorrectNetwork, setOnCorrectNetwork] = useState(false);
  const [batchCount, setBatchCount] = useState("0");

  const [produceType, setProduceType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");

  const [trackingId, setTrackingId] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [farmerTrustScore, setFarmerTrustScore] = useState<string | null>(null);

  // status text to apply to the currently-tracked batch (used by handleUpdateStatus below)
  const [newStatus, setNewStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // FIX: was missing, needed by handleUpdateStatus/handleConfirmDelivery

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getProvider = () => {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }
    return new ethers.BrowserProvider(window.ethereum);
  };

  const getContract = async (withSigner = false) => {
    const provider = getProvider();
    if (withSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  };

  const loadBatchCount = useCallback(async () => {
    try {
      const contract = await getContract();
      const count = await contract.batchCount();
      setBatchCount(count.toString());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const checkNetwork = useCallback(async () => {
    try {
      const provider = getProvider();
      const networkInfo = await provider.getNetwork();
      // networkInfo.chainId is a BigInt in ethers v6 - compare as Number on both sides
      const isSepolia = Number(networkInfo.chainId) === Number(SEPOLIA_CHAIN_ID);
      setOnCorrectNetwork(isSepolia);
      return isSepolia;
    } catch (err) {
      console.error(err);
      setOnCorrectNetwork(false);
      return false;
    }
  }, []);

  const switchToSepolia = async () => {
    try {
      setError("");
      await window.ethereum?.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_HEX }],
      });
      await checkNetwork();
    } catch (err: any) {
      setError(err?.message || "Could not switch network. Please switch manually in MetaMask.");
    }
  };

  const connectWallet = async () => {
    try {
      setError("");
      setMessage("");

      if (!window.ethereum) {
        setError("MetaMask isn't installed. Install it from metamask.io to continue.");
        return;
      }

      const provider = getProvider();
      const existingAccounts = await provider.send("eth_accounts", []);
      const accounts =
        existingAccounts.length > 0
          ? existingAccounts
          : await provider.send("eth_requestAccounts", []);

      setAccount(accounts[0]);

      const isSepolia = await checkNetwork();
      if (isSepolia) {
        await loadBatchCount();
        setMessage("Wallet connected.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Couldn't connect the wallet.");
    }
  };

  const createBatch = async () => {
    try {
      setError("");
      setMessage("");

      if (!account) {
        setError("Connect your wallet first.");
        return;
      }
      if (!onCorrectNetwork) {
        setError("Switch to Sepolia before creating a batch.");
        return;
      }
      if (!produceType.trim()) {
        setError("Enter the produce type.");
        return;
      }
      if (!quantity || Number(quantity) <= 0) {
        setError("Enter a valid quantity.");
        return;
      }

      setLoading(true);

      const contract = await getContract(true);
      setMessage("Confirm the transaction in MetaMask...");

      const tx = await contract.createBatch(
        produceType,
        BigInt(quantity),
        ipfsHash || ""
      );

      setMessage("Transaction submitted, waiting for confirmation...");
      await tx.wait();

      setMessage(`Batch created. Transaction: ${tx.hash.slice(0, 12)}...`);
      setProduceType("");
      setQuantity("");
      setIpfsHash("");

      await loadBatchCount();
    } catch (err: any) {
      console.error(err);
      if (err?.code === 4001) {
        setError("Transaction rejected in MetaMask.");
      } else {
        setError(err?.reason || err?.message || "Couldn't create the batch.");
      }
    } finally {
      setLoading(false);
    }
  };

  const trackBatch = async () => {
    try {
      setError("");
      setMessage("");
      setBatch(null);
      setHistory([]);
      setFarmerTrustScore(null);

      if (!trackingId || Number(trackingId) <= 0) {
        setError("Enter a valid batch ID.");
        return;
      }

      setTracking(true);

      const contract = await getContract();
      const count = await contract.batchCount();

      if (BigInt(trackingId) > count) {
        setError(`Batch #${trackingId} doesn't exist yet.`);
        return;
      }

      const result = await contract.batches(BigInt(trackingId));

      const batchData: Batch = {
        id: result[0],
        produceType: result[1],
        quantityKg: result[2],
        farmer: result[3],
        ipfsHash: result[4],
        timestamp: result[5],
        status: result[6],
        delivered: result[7], 
      };

      setBatch(batchData);

      const [historyResult, trustScore] = await Promise.all([
        contract.getHistory(BigInt(trackingId)),
        contract.getTrustScore(batchData.farmer),
      ]);

      setHistory(historyResult);
      setFarmerTrustScore(trustScore.toString());
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Couldn't load that batch.");
    } finally {
      setTracking(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!batch) return;
    if (!newStatus.trim()) {
      setError("Enter a status to set, e.g. 'In Transit'.");
      return;
    }
    try {
      setError("");
      setMessage("");
      setActionLoading(true);

      const contract = await getContract(true);
      const tx = await contract.updateStatus(batch.id, newStatus.trim());
      setMessage("Updating status on-chain...");
      await tx.wait();

      setMessage("Status updated.");
      setNewStatus("");
      await trackBatch();
    } catch (err: any) {
      console.error(err);
      setError(err?.reason || err?.message || "Couldn't update status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!batch) return;
    try {
      setError("");
      setMessage("");
      setActionLoading(true);

      const contract = await getContract(true);
      const tx = await contract.confirmDelivery(batch.id);
      setMessage("Confirming delivery on-chain...");
      await tx.wait();

      setMessage("Delivery confirmed. Farmer's trust score updated.");
      await trackBatch();
    } catch (err: any) {
      console.error(err);
      setError(err?.reason || err?.message || "Couldn't confirm delivery.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    window.ethereum.request({ method: "eth_accounts" }).then(async (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const isSepolia = await checkNetwork();
        if (isSepolia) await loadBatchCount();
      }
    });

    const handleAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] || "");
      setMessage("");
      setError("");
    };
    const handleChainChanged = async () => {
      const isSepolia = await checkNetwork();
      if (isSepolia) await loadBatchCount();
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [checkNetwork, loadBatchCount]);

  const formatDate = (timestamp: bigint) =>
    new Date(Number(timestamp) * 1000).toLocaleString();

  const shortenAddress = (address: string) =>
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  const ipfsUrl = (hash: string) =>
    hash ? `https://gateway.pinata.cloud/ipfs/${hash}` : "";

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6faf7] text-gray-900">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-150px] top-[-150px] h-[400px] w-[400px] rounded-full bg-green-200/30 blur-3xl" />
        <div className="absolute right-[-150px] top-[300px] h-[400px] w-[400px] rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-green-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-2xl shadow-lg shadow-green-600/20">
              🌱
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-green-800">AgriChain</h1>
              <p className="text-xs text-gray-500">Farm-to-consumer traceability</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {account && !onCorrectNetwork && (
              <button
                onClick={switchToSepolia}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Switch to Sepolia
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={connectWallet}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition ${
                account ? "bg-green-600 hover:bg-green-700" : "bg-gray-900 hover:bg-gray-800"
              }`}
            >
              {account ? `Connected: ${shortenAddress(account)}` : "Connect MetaMask"}
            </motion.button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-black leading-tight tracking-tight md:text-6xl">
              From <span className="text-green-600">farm</span> to{" "}
              <span className="text-emerald-500">table</span>, on the record.
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Every batch of produce gets a permanent, tamper-proof history —
              from harvest through transport to delivery — that anyone can verify
              on the Ethereum blockchain.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#create"
                className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white shadow-lg shadow-green-600/20 transition hover:-translate-y-1 hover:bg-green-700"
              >
                Register a batch
              </a>
              <a
                href="#track"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                Track a batch
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="relative mx-auto flex h-[350px] max-w-md items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute h-72 w-72 rounded-full border border-dashed border-green-300"
              />
              <div className="flex h-52 w-52 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-8xl shadow-2xl shadow-green-700/30">
                🌾
              </div>
              <div className="absolute left-0 top-12 rounded-xl border bg-white/90 p-4 shadow-xl backdrop-blur">
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-bold text-green-700">
                  {onCorrectNetwork ? "Connected" : "Not connected"}
                </p>
              </div>
              <div className="absolute bottom-10 right-0 rounded-xl border bg-white/90 p-4 shadow-xl backdrop-blur">
                <p className="text-xs text-gray-500">Network</p>
                <p className="font-bold">Sepolia</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { title: "Network", value: onCorrectNetwork ? "Sepolia" : "Not connected", icon: "⛓️" },
            { title: "Registered batches", value: batchCount, icon: "📦" },
            { title: "Contract", value: "ProduceBatch", icon: "📜" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{item.title}</p>
                  <h3 className="mt-2 text-2xl font-bold">{item.value}</h3>
                </div>
                <div className="text-3xl">{item.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CREATE BATCH */}
      <section id="create" className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-3xl border border-green-100 bg-white p-8 shadow-xl md:p-10">
          <div className="max-w-2xl">
            <h3 className="text-3xl font-bold">Register a new batch</h3>
            <p className="mt-3 text-gray-600">
              This writes a permanent record to Sepolia. Once submitted, the
              batch's origin can't be altered.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold">Produce type</label>
              <input
                value={produceType}
                onChange={(e) => setProduceType(e.target.value)}
                placeholder="Tomatoes"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">Quantity (kg)</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="500"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold">IPFS CID (optional)</label>
              <input
                value={ipfsHash}
                onChange={(e) => setIpfsHash(e.target.value)}
                placeholder="From Pinata upload"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>
          </div>

          {ipfsHash && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <img
                src={ipfsUrl(ipfsHash)}
                alt="Batch preview"
                className="h-16 w-16 rounded-lg object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
              <p className="text-sm text-gray-500">Preview of the linked IPFS file</p>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            onClick={createBatch}
            className="mt-7 rounded-xl bg-green-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Waiting for confirmation..." : "Create batch on-chain"}
          </motion.button>
        </div>
      </section>

      {/* MESSAGE */}
      <AnimatePresence>
        {(message || error) && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-auto max-w-7xl px-6"
          >
            <div
              className={`rounded-xl border p-4 ${
                error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {error || message}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* TRACK */}
      <section id="track" className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-3xl bg-gray-900 p-8 text-white shadow-2xl md:p-10">
          <h3 className="text-3xl font-bold">Track a batch</h3>
          <p className="mt-3 text-gray-400">
            Enter a batch ID to pull its full history straight from the blockchain.
          </p>

          <div className="mt-8 flex max-w-xl gap-3">
            <input
              type="number"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder="Batch ID"
              className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-green-500"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={tracking}
              onClick={trackBatch}
              className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-500 disabled:opacity-60"
            >
              {tracking ? "Loading..." : "Track"}
            </motion.button>
          </div>

          {batch && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 rounded-2xl bg-white p-6 text-gray-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">Batch ID</p>
                  <h4 className="text-3xl font-bold">#{batch.id.toString()}</h4>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    batch.delivered
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {batch.status}
                </span>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Produce</p>
                  <p className="mt-1 font-bold">{batch.produceType}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="mt-1 font-bold">{batch.quantityKg.toString()} kg</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Farmer</p>
                  <p className="mt-1 font-mono text-sm font-bold">{shortenAddress(batch.farmer)}</p>
                  {farmerTrustScore !== null && (
                    <p className="mt-1 text-sm text-green-600">
                      Trust score: {farmerTrustScore}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="mt-1 font-medium">{formatDate(batch.timestamp)}</p>
                </div>
                {batch.ipfsHash && (
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Linked file</p>
                    <a
                      href={ipfsUrl(batch.ipfsHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate font-medium text-green-600 hover:underline"
                    >
                      View on IPFS
                    </a>
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              {account && !batch.delivered && (
                <div className="mt-8 grid gap-4 rounded-xl border border-gray-100 p-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Update status</label>
                    <div className="flex gap-2">
                      <input
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        placeholder="In Transit"
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-green-500"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={handleUpdateStatus}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">Received the goods?</label>
                    <button
                      disabled={actionLoading}
                      onClick={handleConfirmDelivery}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      Confirm delivery
                    </button>
                    <p className="mt-1 text-xs text-gray-500">
                      Confirming rewards the farmer's trust score and locks the batch.
                    </p>
                  </div>
                </div>
              )}

              {/* TIMELINE */}
              <div className="mt-10">
                <h5 className="text-xl font-bold">History</h5>
                <div className="mt-6 space-y-5">
                  {history.map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                          ✓
                        </div>
                        {index !== history.length - 1 && (
                          <div className="h-full w-px bg-green-200" />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className="font-bold">{item.status}</p>
                        <p className="mt-1 text-sm text-gray-500">{formatDate(item.timestamp)}</p>
                        <p className="mt-1 font-mono text-xs text-gray-400">
                          {shortenAddress(item.updatedBy)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* FLOW */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="text-center">
          <h3 className="text-3xl font-bold">The journey every batch takes</h3>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {[
            ["🌱", "Farmer"],
            ["🚚", "Transport"],
            ["🏭", "Warehouse"],
            ["🏪", "Retailer"],
            ["🛒", "Consumer"],
          ].map(([icon, title]) => (
            <div
              key={title}
              className="rounded-2xl border bg-white p-6 text-center shadow-sm transition hover:-translate-y-1"
            >
              <div className="text-4xl">{icon}</div>
              <p className="mt-3 font-bold">{title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-white py-8 text-center">
        <p className="font-semibold text-green-700">🌱 AgriChain</p>
        <p className="mt-2 text-sm text-gray-500">
          Blockchain-based supply chain transparency for agricultural produce
        </p>
        <p className="mt-2 text-xs text-gray-400">Built on Ethereum Sepolia</p>
      </footer>
    </main>
  );
}