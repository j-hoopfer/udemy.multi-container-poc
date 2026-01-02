import React, { Component } from "react";
class Fib extends Component {
    constructor(props) {
        super(props);
        this.state = {
            seenIndexes: [],
            values: {},
            index: "",
        };
    }

    componentDidMount() {
        this.fetchValues();
        this.fetchIndexes();
    }

    async fetchValues() {
        try {
            const response = await fetch("/api/values/current");
            if (!response.ok) {
                console.error("Failed to fetch values:", response.status);
                return;
            }
            const data = await response.json();
            this.setState({ values: data.values || {} });
        } catch (err) {
            console.error("Error fetching values:", err);
        }
    }

    async fetchIndexes() {
        try {
            const response = await fetch("/api/values/all");
            if (!response.ok) {
                console.error("Failed to fetch indexes:", response.status);
                return;
            }
            const data = await response.json();
            this.setState({ seenIndexes: Array.isArray(data) ? data : [] });
        } catch (err) {
            console.error("Error fetching indexes:", err);
        }
    }

    handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const response = await fetch("/api/values", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    index: this.state.index,
                }),
            });

            if (!response.ok) {
                console.error("Failed to submit value:", response.status);
                return;
            }

            this.setState({ index: "" });
            
            // Refetch the data after successful submission
            this.fetchValues();
            this.fetchIndexes();
        } catch (err) {
            console.error("Error submitting value:", err);
        }
    };

    renderValues() {
        const entries = [];

        for (let key in this.state.values) {
            entries.push(
                <div key={key}>
                    For index {key} I calculated {this.state.values[key]}
                </div>
            );
        }

        return entries;
    }

    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <label>Enter your index:</label>
                    <input
                        value={this.state.index}
                        onChange={(event) => this.setState({ index: event.target.value })}
                    />
                    <button>Submit</button>
                </form>

                <h3>Indexes I have seen:</h3>
                {this.renderSeenIndexes()}

                <h3>Calculated Values:</h3>
                {this.renderValues()}
            </div>
        );
    }
    renderSeenIndexes() {
        return this.state.seenIndexes.map(({ number }) => number).join(", ");
    }
}

export default Fib;