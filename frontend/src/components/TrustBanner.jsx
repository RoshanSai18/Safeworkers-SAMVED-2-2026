import React from 'react';
import './TrustBanner.css';

const partners = [
    { name: 'BBMP', full: 'Bruhat Bengaluru Mahanagara Palike' },
    { name: 'BMC',  full: 'Brihanmumbai Municipal Corporation'  },
    { name: 'GHMC', full: 'Greater Hyderabad Municipal Corp.'   },
    { name: 'NMMC', full: 'Navi Mumbai Municipal Corporation'   },
    { name: 'MCD',  full: 'Municipal Corporation of Delhi'      },
];

const TrustBanner = () => (
    <div className="trust-banner">
        <div className="container trust-inner">
            <p className="trust-label">Designed for municipalities across India</p>
            <div className="trust-logos">
                {partners.map((p, i) => (
                    <div key={i} className="trust-chip">
                        <span className="trust-chip-abbr">{p.name}</span>
                        <span className="trust-chip-full">{p.full}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default TrustBanner;
