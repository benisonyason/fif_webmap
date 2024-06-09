"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import MapComponent from "@/pages/api/map";

interface Boundary {
  sd_ref: string;
  adm1_en: string;
  numwards: number;
  infras: number;
  // Add more properties as needed
}

const MyPage: React.FC = () => {
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredBoundaries, setFilteredBoundaries] = useState<Boundary[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get("/api/senatorial_boundaries");
        const sortedBoundaries = response.data.features
          .map((feature: any) => feature.properties)
          .sort((a: Boundary, b: Boundary) => b.infras - a.infras);
        setBoundaries(sortedBoundaries);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    // Filter boundaries based on search query
    const filtered = boundaries
      .filter(
        (boundary) =>
          boundary.sd_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
          boundary.adm1_en.toLowerCase().includes(searchQuery.toLowerCase())
        // Add more properties to filter on if needed
      )
      .sort((a, b) => b.infras - a.infras); // Ensure filtered boundaries are sorted
    setFilteredBoundaries(filtered);
  }, [searchQuery, boundaries]);

  return (
    <div>
      <div className="topnav">
        <a href="#default" className="logo">
          FIF INTERACTIVE GIS DATABASE OF FARMLANDS/INFRASTRUCTURES
        </a>
      </div>

      <div className="sidenav">
        <h2>State Zones</h2>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <table>
          <thead>
            <tr>
              <th>Zone</th>
              <th>No. of Ward</th>
              <th>No. of Infras</th>
              {/* Add more table headers as needed */}
            </tr>
          </thead>
          <tbody>
            {filteredBoundaries.map((boundary, index) => (
              <tr key={index}>
                <td>{boundary.sd_ref}</td>
                <td>{boundary.numwards}</td>
                <td>{boundary.infras}</td>
                {/* Render more table cells for additional properties */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="map">
        <MapComponent />
      </div>
      <div className="footer">
        <p>Copyright@FIF2024</p>
      </div>
    </div>
  );
};

export default MyPage;
