import { useState } from "react";
import { isAdmin } from "shared";
import { useSession } from "./lib/useSession";
import { TopBar } from "./components/TopBar";
import { Tabs, type TabId } from "./components/Tabs";
import { NewRequestModal } from "./components/NewRequestModal";
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

  function changeMe(p: typeof me) {
    setMe(p);
    if (!isAdmin(p) && (tab === "beoordelen" || tab === "alle")) setTab("kalender");
  }

  return (
    <>
      <TopBar me={me} onChangeMe={changeMe} onNewRequest={() => setShowNewRequest(true)} />
      <Tabs tab={tab} onChange={setTab} admin={admin} openCount={openCount} />
      <main>
        {tab === "kalender" && <CalendarPage />}
        {tab === "mijn" && <MyOverviewPage me={me} key={myRefresh} />}
        {tab === "beoordelen" && admin && <ReviewPage onCountChange={setOpenCount} />}
        {tab === "alle" && admin && <AllRequestsPage />}
      </main>

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
