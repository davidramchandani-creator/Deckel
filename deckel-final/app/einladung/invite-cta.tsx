"use client";

/**
 * Stores the invite code where the login flow can find it, then heads to
 * login. Plain cookie on purpose: it must survive the email round trip,
 * and it holds nothing sensitive beyond what the URL already showed.
 */
export function InviteCta({ code }: { code: string }) {
  function go() {
    document.cookie = `pop-invite=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={go} className="btn btn-primary w-full">
      Mitmachen
    </button>
  );
}
