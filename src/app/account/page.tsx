"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  createdAt: string;
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/profile")
        .then((res) => res.json())
        .then((data) => {
          setProfile(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/profile", { method: "DELETE" });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      }
    } catch {
      setDeleting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="account-container">
        <div className="loading">Loading...</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="account-container">
      <div className="account-content">
        <div className="account-header">
          <h1 className="account-title">My Account</h1>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">
            {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{profile?.name || "No name set"}</h2>
            <p className="profile-email">{profile?.email}</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">✨</div>
            <div className="stat-value">{profile?.credits ?? 0}</div>
            <div className="stat-label">Invitation Credits</div>
            <Link href="/buy" className="stat-action">
              Buy More →
            </Link>
          </div>
          <div className="stat-card">
            <Link href="/account/payments" className="stat-link">
              <div className="stat-icon">💳</div>
              <div className="stat-label">Payment History</div>
              <div className="stat-action">View →</div>
            </Link>
          </div>
        </div>

        <div className="actions-section">
          <Link href="/create" className="action-button primary">
            Create Invitation
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="action-button secondary"
          >
            Sign Out
          </button>
        </div>

        <div className="danger-zone">
          <h3 className="danger-title">Danger Zone</h3>
          <p className="danger-description">
            Deleting your account will permanently remove all your invitations and data.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="delete-button"
            >
              Delete Account
            </button>
          ) : (
            <div className="delete-confirm">
              <p>Are you sure? This cannot be undone.</p>
              <div className="delete-actions">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="confirm-delete"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cancel-delete"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .account-container {
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

  .account-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .account-header {
    margin-bottom: 2rem;
  }

  .account-title {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
  }

  .profile-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .profile-avatar {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
    color: #fff;
  }

  .profile-info {
    flex: 1;
  }

  .profile-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.25rem;
  }

  .profile-email {
    color: rgba(255, 255, 255, 0.6);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    text-align: center;
  }

  .stat-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .stat-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: #fff;
  }

  .stat-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .stat-action {
    color: #818cf8;
    font-size: 0.9rem;
    text-decoration: none;
  }

  .actions-section {
    display: flex;
    gap: 1rem;
    margin-bottom: 3rem;
  }

  .action-button {
    flex: 1;
    padding: 1rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    text-decoration: none;
  }

  .action-button.primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    color: #fff;
  }

  .action-button.secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .danger-zone {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .danger-title {
    color: #fca5a5;
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .danger-description {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .delete-button {
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #fca5a5;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .delete-confirm {
    text-align: center;
  }

  .delete-confirm p {
    color: #fca5a5;
    margin-bottom: 1rem;
  }

  .delete-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .confirm-delete {
    background: #ef4444;
    border: none;
    color: #fff;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .cancel-delete {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
  }
`;
