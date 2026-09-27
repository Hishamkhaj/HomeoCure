import fs from "fs";

const appPath = "src/App.jsx";
let app = fs.readFileSync(appPath, "utf8");

if (!app.includes('import IntelligenceView from "./components/IntelligenceView";')) {
  app = app.replace(
    'import AnalyticsView from "./components/AnalyticsView";',
    'import AnalyticsView from "./components/AnalyticsView";\nimport IntelligenceView from "./components/IntelligenceView";'
  );
}

app = app.replace(
  'Layers, Wallet, X }',
  'Layers, Wallet, Sparkles, X }'
);

if (!app.includes('key: "intelligence"')) {
  app = app.replace(
    '{ key: "income", label: "Income", icon: Wallet, color: "#DC2626" },',
    '{ key: "income", label: "Income", icon: Wallet, color: "#DC2626" },\n    { key: "intelligence", label: "Intelligence", icon: Sparkles, color: "#148A7A" },'
  );
}

app = app.replace(
  '<TodayView patients={patients} onSelect={goToPatientFromFollowUp} />',
  '<TodayView patients={patients} onSelect={goToPatientFromFollowUp} onNavigate={(key) => setTab(key)} />'
);

if (!app.includes('tab === "intelligence"')) {
  app = app.replace(
    '{tab === "analytics" && <AnalyticsView />}',
    '{tab === "analytics" && <AnalyticsView />}\n\n        {tab === "intelligence" && <IntelligenceView onBack={() => setTab("today")} />}'
  );
}

fs.writeFileSync(appPath, app);
console.log("App.jsx integration complete.");
