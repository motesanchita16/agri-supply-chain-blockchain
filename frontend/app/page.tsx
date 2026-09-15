"use client";

import { useState } from "react";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<any>;
    };
  }
}

export default function Home() {
  const [account, setAccount] = useState("");

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-green-700">
              AgriChain
            </h1>
            <p className="text-sm text-gray-500">
              Blockchain-Based Agricultural Supply Chain
            </p>
          </div>

          <button
  className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700"
  onClick={async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setAccount(accounts[0]);
    } catch (error) {
      console.error(error);
      alert("Failed to connect MetaMask");
    }
  }}
>
  {account ? "Wallet Connected" : "Connect MetaMask"}
</button>
        </div>
      </header>

      {/* Main content */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="mb-3 font-semibold text-green-600">
            BLOCKCHAIN SUPPLY CHAIN
          </p>

          <h2 className="text-4xl font-bold leading-tight md:text-5xl">
            Transparent journey of agricultural produce
          </h2>

          <p className="mt-5 text-lg text-gray-600">
            Track agricultural produce from farm to consumer using
            blockchain technology, smart contracts and verifiable
            supply-chain records.
          </p>
        </div>

        {/* Dashboard cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Blockchain Network</p>
            <h3 className="mt-2 text-xl font-bold">Sepolia</h3>
            <p className="mt-2 text-sm text-green-600">
              Testnet
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Smart Contract</p>
            <h3 className="mt-2 text-xl font-bold">ProduceBatch</h3>
            <p className="mt-2 text-sm text-gray-600">
              Batch tracking contract
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Wallet</p>
            <h3 className="mt-2 text-xl font-bold">
              {account || "Not Connected"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              MetaMask account
            </p>
          </div>
        </div>

        {/* Create batch */}
        <div className="mt-10 rounded-xl border bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-bold">
            Create Agricultural Batch
          </h3>

          <p className="mt-2 text-gray-600">
            Register a new produce batch on the blockchain.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <input
              type="text"
              placeholder="Produce type"
              className="rounded-lg border px-4 py-3 outline-none focus:border-green-500"
            />

            <input
              type="number"
              placeholder="Quantity (kg)"
              className="rounded-lg border px-4 py-3 outline-none focus:border-green-500"
            />

            <input
              type="text"
              placeholder="IPFS CID"
              className="rounded-lg border px-4 py-3 outline-none focus:border-green-500"
            />
          </div>

          <button
            className="mt-5 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
            onClick={() => alert("Blockchain transaction coming next!")}
          >
            Create Batch
          </button>
        </div>

        {/* Tracking */}
        <div className="mt-10 rounded-xl border bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-bold">
            Track Produce Batch
          </h3>

          <p className="mt-2 text-gray-600">
            Enter a batch ID to view its blockchain history.
          </p>

          <div className="mt-6 flex max-w-xl gap-3">
            <input
              type="number"
              placeholder="Batch ID"
              className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-green-500"
            />

            <button
              className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800"
              onClick={() => alert("Batch tracking coming next!")}
            >
              Track
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
        AgriChain — Blockchain-Based Supply Chain Transparency
      </footer>
    </main>
  );
}