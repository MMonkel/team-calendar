import { useCallback, useEffect, useState } from "react";
import { isAdmin } from "shared";
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
  const { me, setMe, admin } = useSession();
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

  function changeMe(p: typeof me) {
    setMe(p);
    if (!isAdmin(p) && (tab === "beoordelen" || tab === "alle")) setTab("kalender");
  }

  return (
    <>
      <PullToRefresh onRefresh={refresh} />
      <TopBar
        me={me}
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
