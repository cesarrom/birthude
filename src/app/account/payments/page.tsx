"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Payment {
  id: string;
  status: string;
  amountUsd: number;
  creditsGranted: number;
  createdAt: string;
  completedAt: string | null;
  packageName: string | null;
}

export default function PaymentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/payments")
        .then((res) => res.json())
        .then((data) => {
          setPayments(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="payments-container">
        <div className="loading">Loading...</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="payments-container">
      <div className="payments-content">
        <div className="payments-header">
          <Link href="/account" className="back-link">← Back</Link>
          <h1 className="payments-title">Payment History</h1>
        </div>

        {payments.length === 0 ? (
          <div className="no-payments">
            <p>No payments yet.</p>
            <Link href="/buy" className="buy-link">Buy Credits →</Link>
          </div>
        ) : (
          <div className="payments-list">
            {payments.map((payment) => (
              <div key={payment.id} className="payment-card">
                <div className="payment-main">
                  <div className="payment-info">
                    <h3 className="payment-package">{payment.packageName || "Unknown Package"}</h3>
                    <p className="payment-date">
                      {new Date(payment.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="payment-amount">
                    ${(payment.amountUsd / 100).toFixed(2)}
                  </div>
                </div>
                <div className="payment-footer">
                  <span className={`payment-status status-${payment.status}`}>
                    {payment.status}
                  </span>
                  <span className="payment-credits">
                    +{payment.creditsGranted} credits
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .payments-container {
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
  }

  .payments-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .payments-header {
    margin-bottom: 2rem;
  }

  .back-link {
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 0.9rem;
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    color: #fff;
  }

  .payments-title {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
  }

  .no-payments {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    padding: 3rem;
  }

  .buy-link {
    display: inline-block;
    margin-top: 1rem;
    color: #818cf8;
    text-decoration: none;
  }

  .payments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .payment-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1.25rem;
  }

  .payment-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .payment-package {
    font-size: 1.1rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.25rem;
  }

  .payment-date {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
  }

  .payment-amount {
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
  }

  .payment-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .payment-status {
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
    text-transform: capitalize;
  }

  .status-completed {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  .status-pending {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
  }

  .status-failed {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .payment-credits {
    color: #a5b4fc;
    font-size: 0.9rem;
  }
`;
