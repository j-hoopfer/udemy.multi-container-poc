import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState } from "react";

import Fib from "./Fib";
import OtherPage from "./OtherPage";

function App() {
    const [count, setCount] = useState(0);

    return (
        <Router>
            <main className="app">
                <div>
                    <header className="App-header">
                        <h1>Hello Vite + React!</h1>
                    </header>

                    <div>
                        <Link to="/">Home</Link>
                    </div>
                    <div>
                        <Link to="/otherpage">Other Page</Link>
                    </div>
                    
                    <Routes>
                        <Route path="/" element={<Fib />} />
                        <Route path="/otherpage" element={<OtherPage />} />
                    </Routes>
                </div>
            </main>

        </Router>
    );
}

export default App;
