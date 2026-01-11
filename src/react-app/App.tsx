/**
 * SmokeScan Main Application
 * FDAM Fire Damage Assessment Tool
 */

import { Routes, Route } from 'react-router-dom';
import { ProjectList, ProjectDetail, AssessmentWizard, AssessmentView } from './pages';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>SmokeScan</h1>
        <p className="tagline">FDAM Fire Damage Assessment</p>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/assess/:assessmentId" element={<AssessmentWizard />} />
          <Route path="/assessments/:id" element={<AssessmentView />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>SmokeScan v1.0 | FDAM v4.0.1 Methodology</p>
      </footer>
    </div>
  );
}

export default App;
