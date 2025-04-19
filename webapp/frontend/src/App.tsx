import React from 'react';
import { ConfigProvider } from 'antd';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import LetterList from './components/LetterList';
import LetterView from './components/LetterView';

const App: React.FC = () => (
  <ConfigProvider theme={{ token: { colorPrimary: '#00b96b' } }}>
    <Router>
      <Routes>
        <Route path="/" element={<LetterList />} />
        <Route path="/letters/:id" element={<LetterView />} />
      </Routes>
    </Router>
  </ConfigProvider>
);

export default App;