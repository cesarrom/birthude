"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Package {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  priceUsd: number;
}

export default function BuyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");
  const paymentId = searchParams.get("payment_id"); // dLocal Go returns payment_id

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Fetch packages
  useEffect(() => {
    fetch("/api/packages")
      .then((res) => res.json())
      .then((data) => {
        setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch user credits
  useEffect(() => {
    if (session?.user) {
      fetch("/api/user/profile")
        .then((res) => res.json())
        .then((data) => setUserCredits(data.credits ?? 0))
        .catch(() => { });
    }
  }, [session]);

  // Handle return from dLocal Go
  useEffect(() => {
    if (success === "true" && paymentId) {
      setProcessing("capturing");
      fetch("/api/payments/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMessage({ type: "success", text: data.message });
            setUserCredits((prev) => (prev ?? 0) + data.credits);
          } else {
            setMessage({ type: "error", text: data.error || "Payment failed" });
          }
          setProcessing(null);
          // Clear URL params
          router.replace("/buy");
        })
        .catch(() => {
          setMessage({ type: "error", text: "Failed to process payment" });
          setProcessing(null);
        });
    } else if (cancelled === "true") {
      setMessage({ type: "error", text: "Payment was cancelled" });
      router.replace("/buy");
    }
  }, [success, cancelled, paymentId, router]);

  async function handlePurchase(pkg: Package) {
    setProcessing(pkg.id);
    setMessage(null);

    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await res.json();

      if (data.redirectUrl) {
        // Redirect to dLocal Go checkout
        window.location.href = data.redirectUrl;
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create order" });
        setProcessing(null);
      }
    } catch {
      setMessage({ type: "error", text: "Failed to start checkout" });
      setProcessing(null);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="buy-container">
        <div className="loading">Loading...</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="buy-container">
      <div className="buy-content">
        <div className="buy-header">
          <h1 className="buy-title">Get Invitation Credits</h1>
          <p className="buy-subtitle">
            Purchase credits to add invitees to your invitations
          </p>
          {userCredits !== null && (
            <div className="credits-badge">
              <span className="credits-icon">✨</span>
              <span>You have <strong>{userCredits}</strong> credits</span>
            </div>
          )}
        </div>

        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {processing === "capturing" && (
          <div className="processing-overlay">
            <div className="processing-card">
              <div className="spinner"></div>
              <p>Processing your payment...</p>
            </div>
          </div>
        )}

        <div className="packages-grid">
          {packages.map((pkg) => (
            <div key={pkg.id} className="package-card">
              <div className="package-header">
                <h2 className="package-name">{pkg.name}</h2>
                {pkg.description && (
                  <p className="package-description">{pkg.description}</p>
                )}
              </div>
              <div className="package-credits">
                <span className="credits-number">{pkg.credits}</span>
                <span className="credits-label">invitee credits</span>
              </div>
              <div className="package-price">
                ${(pkg.priceUsd / 100).toFixed(2)}
              </div>
              <div className="price-per-credit">
                ${(pkg.priceUsd / 100 / pkg.credits).toFixed(2)} per credit
              </div>
              <button
                onClick={() => handlePurchase(pkg)}
                disabled={processing !== null}
                className="purchase-button"
              >
                {processing === pkg.id ? "Processing..." : "Buy Now"}
              </button>
            </div>
          ))}
        </div>

        {packages.length === 0 && !loading && (
          <div className="no-packages">
            <p>No packages available at the moment.</p>
          </div>
        )}

        <div className="buy-footer">
          <Link href="/create" className="back-link">
            ← Back to Create
          </Link>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .buy-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    padding: 2rem 1rem;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.2rem;
  }

  .buy-content {
    max-width: 1000px;
    margin: 0 auto;
  }

  .buy-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .buy-title {
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.75rem;
  }

  .buy-subtitle {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.1rem;
  }

  .credits-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 1.25rem;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 100px;
    color: #a5b4fc;
    font-size: 0.95rem;
  }

  .credits-icon {
    font-size: 1.1rem;
  }

  .message {
    padding: 1rem 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    text-align: center;
  }

  .message.success {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #86efac;
  }

  .message.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .processing-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .processing-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    padding: 2rem 3rem;
    border-radius: 16px;
    text-align: center;
    color: #fff;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .packages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.5rem;
  }

  .package-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .package-card:hover {
    transform: translateY(-4px);
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow: 0 20px 40px -15px rgba(99, 102, 241, 0.3);
  }

  .package-header {
    margin-bottom: 1.5rem;
  }

  .package-name {
    font-size: 1.4rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .package-description {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
  }

  .package-credits {
    margin-bottom: 1rem;
  }

  .credits-number {
    font-size: 3rem;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: block;
  }

  .credits-label {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
  }

  .package-price {
    font-size: 1.75rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.25rem;
  }

  .price-per-credit {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  .purchase-button {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .purchase-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
  }

  .purchase-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .no-packages {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding: 3rem;
  }

  .buy-footer {
    margin-top: 3rem;
    text-align: center;
  }

  .back-link {
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #fff;
  }
`;
