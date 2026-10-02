import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import Loans from './pages/Loans.jsx'
import Marketers from './pages/Marketers.jsx'
import NotFound from './pages/NotFound.jsx'
import PlotBooking from './pages/PlotBooking.jsx'
import Projects from './pages/Projects.jsx'
import Vouchers from './pages/Vouchers.jsx'

/**
 * HashRouter keeps the dashboard working from any static host (or even by
 * opening dist/index.html directly) without server rewrite rules.
 */
export default function App() {
  return (
    <StoreProvider>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/marketers" replace />} />
                <Route path="/marketers" element={<Marketers />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<Projects />} />
                <Route path="/bookings" element={<PlotBooking />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/vouchers" element={<Vouchers />} />
                <Route path="/vouchers/office" element={<Vouchers />} />
                <Route path="/vouchers/promotion" element={<Vouchers />} />
                <Route path="/vouchers/registration" element={<Vouchers />} />
                <Route path="/vouchers/site" element={<Vouchers />} />
                <Route path="/vouchers/site/:head" element={<Vouchers />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </StoreProvider>
  )
}