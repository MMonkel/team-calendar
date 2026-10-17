import { useCallback, useEffect, useState } from "react";
import { isAdmin, type Person } from "shared";
import { useSession } from "./lib/useSession";
import { api } from "./lib/api";
import { useActivityNotices } from "./lib/useActivityNotices";
import { ActivityNoticesModal } from "./components/ActivityNoticesModal";
import { TopBar } from "./components/TopBar";
import { Tabs, type TabId } from "./components/Tabs";
import { NewRequestModal } from "./components/NewRequestModal";
import { PullToRefresh } from "./components/PullToRefresh";
import { CalendarPage } from "./pages/CalendarPage";
import { MyOverviewPage } from "./pages/MyOverviewPage";
import { ReviewPage } from "./pages/ReviewPage";
import { AllRequestsPage } from "./pages/AllRequestsPage";

export default function App() {
  const session = useSession();
  if (session.status === "loading") return null;
  if (session.status !== "ready") {
    return (
      <main className="gate">
        <h1>Team S</h1>
        <p>{session.message}</p>
        {session.status === "not_in_team" && (
          <p>Vraag Alexandra of Marc om je adres toe te voegen, of log in met een ander account.</p>
        )}
        <a className="btn" href="/.auth/logout?post_logout_redirect_uri=/">Uitloggen</a>
      </main>
    );
  }
  return <Shell me={session.me} setMe={session.setMe} admin={session.admin} devMode={session.devMode} />;
}

function Shell({ me, setMe, admin, devMode }: {
  me: Person;
  setMe: (p: Person) => void;
  admin: boolean;
  devMode: boolean;
}) {
  const [tab, setTab] = useState<TabId>("kalender");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [myRefresh, setMyRefresh] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refresh = useCallback(() => setRefreshSignal((n) => n + 1), []);

  // Aantal openstaande aanvragen voor het belletje: bij laden, bij verversen,
  // elke minuut en zodra de app weer in beeld komt.
  useEffect(() => {
    if (!admin) { setOpenCount(0); return; }
    let alive = true;
    const load = () => {
      api.requests({ status: "draft" })
        .then((rows) => { if (alive) setOpenCount(rows.length); })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [admin, me, refreshSignal]);

  // Medewerkers: belletje voor activiteiten op hun eigen werkdagen.
  const notices = useActivityNotices(me, !admin, refreshSignal);
  const [showNotices, setShowNotices] = useState(false);

  function changeMe(p: Person) {
    setMe(p);
    if (!isAdmin(p) && (tab === "beoordelen" || tab === "alle")) setTab("kalender");
  }

  return (
    <>
      <PullToRefresh onRefresh={refresh} />
      <TopBar
        me={me}
        devMode={devMode}
        onChangeMe={changeMe}
        onNewRequest={() => setShowNewRequest(true)}
        bellCount={admin ? openCount : notices.unseen.length}
        bellLabel={admin ? "Te beoordelen" : "Activiteiten op je werkdagen"}
        onBell={() => (admin ? setTab("beoordelen") : setShowNotices(true))}
      />
      <Tabs tab={tab} onChange={setTab} admin={admin} openCount={openCount} />
      <main>
        {tab === "kalender" && <CalendarPage admin={admin} refreshSignal={refreshSignal} />}
        {tab === "mijn" && <MyOverviewPage me={me} key={myRefresh} refreshSignal={refreshSignal} />}
        {tab === "beoordelen" && admin && <ReviewPage onCountChange={setOpenCount} refreshSignal={refreshSignal} />}
        {tab === "alle" && admin && <AllRequestsPage refreshSignal={refreshSignal} />}
      </main>

      {showNotices && !admin && (
        <ActivityNoticesModal
          activities={notices.activities}
          isNew={notices.isNew}
          onClose={() => { notices.markAllSeen(); setShowNotices(false); }}
        />
      )}

      {showNewRequest && (
        <NewRequestModal
          me={me}
          onClose={() => setShowNewRequest(false)}
          onCreated={() => {
            setShowNewRequest(false);
            setTab("mijn");
            setMyRefresh((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
