import React from "react";
import { Link } from "react-router-dom";

export default function OtherPage() {
    return (
        <div>
            <p>This is another page in the React application.</p>
            <Link to="/">Go back to Home</Link>
        </div>
    )
}