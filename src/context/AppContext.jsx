import React, { createContext, useState, useEffect } from 'react';

export const AppContext = createContext();

const defaultSuppliers = [
    {
        id: "SUP-01",
        name: "Golden Thread Apparel Co.",
        email: "supply@goldenthread.com",
        phone: "+91 94421 87654",
        paid: 4500,
        debt: 1200,
        suppliedVariants: ["MJ-CTC-35", "MJ-CTC-DISP-1M", "MJ-CTC-2M"]
    },
    {
        id: "SUP-02",
        name: "NovaTech Global Components",
        email: "logistics@novatech.com",
        phone: "+1 (555) 321-9870",
        paid: 12000,
        debt: 0,
        suppliedVariants: ["ESG-2X1", "BS-5PRO"]
    },
    {
        id: "SUP-03",
        name: "Highlands Coffee Plantation",
        email: "orders@highlandscoffee.co",
        phone: "+84 24 3974 4283",
        paid: 850,
        debt: 350,
        suppliedVariants: ["L80-PRO", "BS-6PRO"]
    }
];

const defaultProducts = [
    {
        "id": "PROD-001",
        "name": "Majentik Type C to 3.5",
        "category": "Cables & Adapters",
        "description": "Premium Type C to 3.5mm audio jack adapter",
        "unit": "Piece",
        "initialStock": 17,
        "totalAdded": 0,
        "totalConsumed": 7,
        "variants": [
            {
                "sku": "MJ-CTC-35",
                "name": "Standard Option",
                "barcode": "100001",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 5,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-001-S",
                "variantSku": "MJ-CTC-35",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-001-SN",
                "variantSku": "MJ-CTC-35",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-002",
        "name": "Majentik Type C display 1m",
        "category": "Cables & Adapters",
        "description": "Type C charging and data cable with display status 1 meter",
        "unit": "Piece",
        "initialStock": 23,
        "totalAdded": 1,
        "totalConsumed": 5,
        "variants": [
            {
                "sku": "MJ-CTC-DISP-1M",
                "name": "Standard Option",
                "barcode": "100002",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 10,
                    "Singanallur": 9
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-002-S",
                "variantSku": "MJ-CTC-DISP-1M",
                "expiryDate": "2027-12-31",
                "quantity": 10,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-002-SN",
                "variantSku": "MJ-CTC-DISP-1M",
                "expiryDate": "2027-12-31",
                "quantity": 9,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-003",
        "name": "Majentik Type C 2m",
        "category": "Cables & Adapters",
        "description": "Long Type C charging and data cable 2 meters",
        "unit": "Piece",
        "initialStock": 7,
        "totalAdded": 0,
        "totalConsumed": 4,
        "variants": [
            {
                "sku": "MJ-CTC-2M",
                "name": "Standard Option",
                "barcode": "100003",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 2,
                    "Singanallur": 1
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-003-S",
                "variantSku": "MJ-CTC-2M",
                "expiryDate": "2027-12-31",
                "quantity": 2,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-003-SN",
                "variantSku": "MJ-CTC-2M",
                "expiryDate": "2027-12-31",
                "quantity": 1,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-004",
        "name": "Essager 2x1",
        "category": "Chargers",
        "description": "Essager multi-port charger adapter",
        "unit": "Piece",
        "initialStock": 11,
        "totalAdded": 102,
        "totalConsumed": 18,
        "variants": [
            {
                "sku": "ESG-2X1",
                "name": "Standard Option",
                "barcode": "100004",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 50,
                    "Singanallur": 45
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-004-S",
                "variantSku": "ESG-2X1",
                "expiryDate": "2027-12-31",
                "quantity": 50,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-004-SN",
                "variantSku": "ESG-2X1",
                "expiryDate": "2027-12-31",
                "quantity": 45,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-005",
        "name": "Black Shark 5 Pro",
        "category": "Gaming Phones",
        "description": "High-end gaming smartphone by Black Shark",
        "unit": "Piece",
        "initialStock": 46,
        "totalAdded": 0,
        "totalConsumed": 18,
        "variants": [
            {
                "sku": "BS-5PRO",
                "name": "Standard Option",
                "barcode": "100005",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 14,
                    "Singanallur": 14
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-005-S",
                "variantSku": "BS-5PRO",
                "expiryDate": "2027-12-31",
                "quantity": 14,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-005-SN",
                "variantSku": "BS-5PRO",
                "expiryDate": "2027-12-31",
                "quantity": 14,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-006",
        "name": "L80 Pro",
        "category": "Gaming Accessories",
        "description": "Gaming peripheral or accessory Pro edition",
        "unit": "Piece",
        "initialStock": 8,
        "totalAdded": 1,
        "totalConsumed": 9,
        "variants": [
            {
                "sku": "L80-PRO",
                "name": "Standard Option",
                "barcode": "100006",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-007",
        "name": "Black Shark 6 Pro",
        "category": "Gaming Phones",
        "description": "Next-gen premium gaming smartphone",
        "unit": "Piece",
        "initialStock": 12,
        "totalAdded": 2,
        "totalConsumed": 14,
        "variants": [
            {
                "sku": "BS-6PRO",
                "name": "Standard Option",
                "barcode": "100007",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-008",
        "name": "PIVA B3",
        "category": "Gaming Audio",
        "description": "PIVA gaming audio headset or speaker B3",
        "unit": "Piece",
        "initialStock": 35,
        "totalAdded": 60,
        "totalConsumed": 75,
        "variants": [
            {
                "sku": "PIVA-B3",
                "name": "Standard Option",
                "barcode": "100008",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 30,
                    "Singanallur": 25
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-008-S",
                "variantSku": "PIVA-B3",
                "expiryDate": "2027-12-31",
                "quantity": 30,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-008-SN",
                "variantSku": "PIVA-B3",
                "expiryDate": "2027-12-31",
                "quantity": 25,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-009",
        "name": "Silicone ipad",
        "category": "Cases & Protection",
        "description": "Protective silicone case for iPad",
        "unit": "Piece",
        "initialStock": 21,
        "totalAdded": 0,
        "totalConsumed": 20,
        "variants": [
            {
                "sku": "SIL-IPAD",
                "name": "Standard Option",
                "barcode": "100009",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 1,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-009-S",
                "variantSku": "SIL-IPAD",
                "expiryDate": "2027-12-31",
                "quantity": 1,
                "warehouse": "Sulur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-010",
        "name": "Sarafox V10",
        "category": "Gaming Sleeves",
        "description": "Sarafox mobile gaming finger sleeves V10",
        "unit": "Piece",
        "initialStock": 240,
        "totalAdded": 0,
        "totalConsumed": 121,
        "variants": [
            {
                "sku": "SFX-V10",
                "name": "Standard Option",
                "barcode": "100010",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 60,
                    "Singanallur": 59
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-010-S",
                "variantSku": "SFX-V10",
                "expiryDate": "2027-12-31",
                "quantity": 60,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-010-SN",
                "variantSku": "SFX-V10",
                "expiryDate": "2027-12-31",
                "quantity": 59,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-011",
        "name": "Sarafox V9",
        "category": "Gaming Sleeves",
        "description": "Sarafox mobile gaming finger sleeves V9",
        "unit": "Piece",
        "initialStock": 671,
        "totalAdded": 3,
        "totalConsumed": 223,
        "variants": [
            {
                "sku": "SFX-V9",
                "name": "Standard Option",
                "barcode": "100011",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 226,
                    "Singanallur": 225
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-011-S",
                "variantSku": "SFX-V9",
                "expiryDate": "2027-12-31",
                "quantity": 226,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-011-SN",
                "variantSku": "SFX-V9",
                "expiryDate": "2027-12-31",
                "quantity": 225,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-012",
        "name": "Memo C1",
        "category": "Phone Coolers",
        "description": "Memo mobile phone cooling fan C1",
        "unit": "Piece",
        "initialStock": 315,
        "totalAdded": 0,
        "totalConsumed": 282,
        "variants": [
            {
                "sku": "MEMO-C1",
                "name": "Standard Option",
                "barcode": "100012",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 17,
                    "Singanallur": 16
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-012-S",
                "variantSku": "MEMO-C1",
                "expiryDate": "2027-12-31",
                "quantity": 17,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-012-SN",
                "variantSku": "MEMO-C1",
                "expiryDate": "2027-12-31",
                "quantity": 16,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-013",
        "name": "Covo 30w",
        "category": "Chargers",
        "description": "Covo 30W fast charging wall adapter",
        "unit": "Piece",
        "initialStock": 60,
        "totalAdded": 1,
        "totalConsumed": 47,
        "variants": [
            {
                "sku": "COVO-30W",
                "name": "Standard Option",
                "barcode": "100013",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 7,
                    "Singanallur": 7
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-013-S",
                "variantSku": "COVO-30W",
                "expiryDate": "2027-12-31",
                "quantity": 7,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-013-SN",
                "variantSku": "COVO-30W",
                "expiryDate": "2027-12-31",
                "quantity": 7,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-014",
        "name": "Heater Magnetic",
        "category": "Gaming Accessories",
        "description": "Magnetic heater or cooler component for gaming devices",
        "unit": "Piece",
        "initialStock": 26,
        "totalAdded": 60,
        "totalConsumed": 75,
        "variants": [
            {
                "sku": "HTR-MAG",
                "name": "Standard Option",
                "barcode": "100014",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 6,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-014-S",
                "variantSku": "HTR-MAG",
                "expiryDate": "2027-12-31",
                "quantity": 6,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-014-SN",
                "variantSku": "HTR-MAG",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-015",
        "name": "Heater Sticker",
        "category": "Gaming Accessories",
        "description": "Thermal conductive sticker component",
        "unit": "Piece",
        "initialStock": 3,
        "totalAdded": 0,
        "totalConsumed": 3,
        "variants": [
            {
                "sku": "HTR-STK",
                "name": "Standard Option",
                "barcode": "100015",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-016",
        "name": "PIVA GS3 Pro",
        "category": "Gaming Audio",
        "description": "PIVA sound card or gaming audio interface GS3 Pro",
        "unit": "Piece",
        "initialStock": 41,
        "totalAdded": 2,
        "totalConsumed": 37,
        "variants": [
            {
                "sku": "PIVA-GS3P",
                "name": "Standard Option",
                "barcode": "100016",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 3,
                    "Singanallur": 3
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-016-S",
                "variantSku": "PIVA-GS3P",
                "expiryDate": "2027-12-31",
                "quantity": 3,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-016-SN",
                "variantSku": "PIVA-GS3P",
                "expiryDate": "2027-12-31",
                "quantity": 3,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-017",
        "name": "Covo 45w",
        "category": "Chargers",
        "description": "Covo 45W super fast charging wall adapter",
        "unit": "Piece",
        "initialStock": 16,
        "totalAdded": 1,
        "totalConsumed": 7,
        "variants": [
            {
                "sku": "COVO-45W",
                "name": "Standard Option",
                "barcode": "100017",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 5,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-017-S",
                "variantSku": "COVO-45W",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-017-SN",
                "variantSku": "COVO-45W",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-018",
        "name": "Extension normal",
        "category": "Cables & Adapters",
        "description": "Standard power or data extension cable",
        "unit": "Piece",
        "initialStock": 21,
        "totalAdded": 0,
        "totalConsumed": 5,
        "variants": [
            {
                "sku": "EXT-NORM",
                "name": "Standard Option",
                "barcode": "100018",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 8,
                    "Singanallur": 8
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-018-S",
                "variantSku": "EXT-NORM",
                "expiryDate": "2027-12-31",
                "quantity": 8,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-018-SN",
                "variantSku": "EXT-NORM",
                "expiryDate": "2027-12-31",
                "quantity": 8,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-019",
        "name": "Extension L",
        "category": "Cables & Adapters",
        "description": "Right-angle L-shaped extension cable",
        "unit": "Piece",
        "initialStock": 39,
        "totalAdded": 2,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "EXT-L",
                "name": "Standard Option",
                "barcode": "100019",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 20,
                    "Singanallur": 20
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-019-S",
                "variantSku": "EXT-L",
                "expiryDate": "2027-12-31",
                "quantity": 20,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-019-SN",
                "variantSku": "EXT-L",
                "expiryDate": "2027-12-31",
                "quantity": 20,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-020",
        "name": "PIVA S6 Pro",
        "category": "Gaming Audio",
        "description": "Premium sound dynamic hub S6 Pro",
        "unit": "Piece",
        "initialStock": 50,
        "totalAdded": 0,
        "totalConsumed": 15,
        "variants": [
            {
                "sku": "PIVA-S6P",
                "name": "Standard Option",
                "barcode": "100020",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 18,
                    "Singanallur": 17
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-020-S",
                "variantSku": "PIVA-S6P",
                "expiryDate": "2027-12-31",
                "quantity": 18,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-020-SN",
                "variantSku": "PIVA-S6P",
                "expiryDate": "2027-12-31",
                "quantity": 17,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-021",
        "name": "Sarafox X9 Pro",
        "category": "Gaming Sleeves",
        "description": "Premium cooling fibers finger sleeves X9 Pro",
        "unit": "Piece",
        "initialStock": 50,
        "totalAdded": 2,
        "totalConsumed": 22,
        "variants": [
            {
                "sku": "SFX-X9P",
                "name": "Standard Option",
                "barcode": "100021",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 15,
                    "Singanallur": 15
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-021-S",
                "variantSku": "SFX-X9P",
                "expiryDate": "2027-12-31",
                "quantity": 15,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-021-SN",
                "variantSku": "SFX-X9P",
                "expiryDate": "2027-12-31",
                "quantity": 15,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-022",
        "name": "Smonama TH19 Pro",
        "category": "Gaming Accessories",
        "description": "Smonama ergonomic controller grip/cooler TH19 Pro",
        "unit": "Piece",
        "initialStock": 30,
        "totalAdded": 70,
        "totalConsumed": 62,
        "variants": [
            {
                "sku": "SMN-TH19P",
                "name": "Standard Option",
                "barcode": "100022",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 19,
                    "Singanallur": 19
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-022-S",
                "variantSku": "SMN-TH19P",
                "expiryDate": "2027-12-31",
                "quantity": 19,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-022-SN",
                "variantSku": "SMN-TH19P",
                "expiryDate": "2027-12-31",
                "quantity": 19,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-023",
        "name": "لزقه ايباد",
        "category": "Cases & Protection",
        "description": "شاشة حماية زجاجية مخصصة لأجهزة الآيباد",
        "unit": "Piece",
        "initialStock": 25,
        "totalAdded": 0,
        "totalConsumed": 7,
        "variants": [
            {
                "sku": "SCRN-IPAD",
                "name": "Standard Option",
                "barcode": "100023",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 9,
                    "Singanallur": 9
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-023-S",
                "variantSku": "SCRN-IPAD",
                "expiryDate": "2027-12-31",
                "quantity": 9,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-023-SN",
                "variantSku": "SCRN-IPAD",
                "expiryDate": "2027-12-31",
                "quantity": 9,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-024",
        "name": "لزقه موبيل",
        "category": "Cases & Protection",
        "description": "شاشة حماية نانو متكاملة للهواتف الذكية",
        "unit": "Piece",
        "initialStock": 87,
        "totalAdded": 0,
        "totalConsumed": 12,
        "variants": [
            {
                "sku": "SCRN-MOB",
                "name": "Standard Option",
                "barcode": "100024",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 38,
                    "Singanallur": 37
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-024-S",
                "variantSku": "SCRN-MOB",
                "expiryDate": "2027-12-31",
                "quantity": 38,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-024-SN",
                "variantSku": "SCRN-MOB",
                "expiryDate": "2027-12-31",
                "quantity": 37,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-025",
        "name": "HyperX Cloud Alpha",
        "category": "Gaming Audio",
        "description": "HyperX Cloud Alpha pro gaming headset",
        "unit": "Piece",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "HX-CLD-ALPHA",
                "name": "Standard Option",
                "barcode": "100025",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-026",
        "name": "HyperX Cloud 2",
        "category": "Gaming Audio",
        "description": "Legendary HyperX Cloud II 7.1 surround gaming headset",
        "unit": "Piece",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "HX-CLD-2",
                "name": "Standard Option",
                "barcode": "100026",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-027",
        "name": "Memo cx08 pro",
        "category": "Phone Coolers",
        "description": "Magnetic semiconductor mobile phone radiator CX08 Pro",
        "unit": "Piece",
        "initialStock": 50,
        "totalAdded": 48,
        "totalConsumed": 80,
        "variants": [
            {
                "sku": "MEMO-CX08P",
                "name": "Standard Option",
                "barcode": "100027",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 9,
                    "Singanallur": 9
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-027-S",
                "variantSku": "MEMO-CX08P",
                "expiryDate": "2027-12-31",
                "quantity": 9,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-027-SN",
                "variantSku": "MEMO-CX08P",
                "expiryDate": "2027-12-31",
                "quantity": 9,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-028",
        "name": "Dl22 pack",
        "category": "Gaming Accessories",
        "description": "Specialized triggers gaming value pack bundle",
        "unit": "Pack",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "DL22-PACK",
                "name": "Standard Option",
                "barcode": "100028",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-029",
        "name": "trigger sarafox",
        "category": "Gaming Accessories",
        "description": "Mechanical physical triggers by Sarafox for mobile",
        "unit": "Piece",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "SFX-TRIG",
                "name": "Standard Option",
                "barcode": "100029",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-030",
        "name": "مشبك اسود",
        "category": "Gaming Accessories",
        "description": "مشبك تثبيت أسود اللون لحامل الهواتف",
        "unit": "Piece",
        "initialStock": 10,
        "totalAdded": 0,
        "totalConsumed": 0,
        "variants": [
            {
                "sku": "CLIP-BLK",
                "name": "Standard Option",
                "barcode": "100030",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 5,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-030-S",
                "variantSku": "CLIP-BLK",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-030-SN",
                "variantSku": "CLIP-BLK",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-031",
        "name": "مشبك ابيض",
        "category": "Gaming Accessories",
        "description": "مشبك تثبيت أبيض اللون لحامل الهواتف والأجهزة",
        "unit": "Piece",
        "initialStock": 12,
        "totalAdded": 0,
        "totalConsumed": 2,
        "variants": [
            {
                "sku": "CLIP-WHT",
                "name": "Standard Option",
                "barcode": "100031",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 5,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-031-S",
                "variantSku": "CLIP-WHT",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-031-SN",
                "variantSku": "CLIP-WHT",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-032",
        "name": "GK Kuenten",
        "category": "Gaming Accessories",
        "description": "GK Kuenten premium device accessories",
        "unit": "Piece",
        "initialStock": 24,
        "totalAdded": 0,
        "totalConsumed": 13,
        "variants": [
            {
                "sku": "GK-KTN",
                "name": "Standard Option",
                "barcode": "100032",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 1,
                "stock": {
                    "Sulur": 6,
                    "Singanallur": 5
                }
            }
        ],
        "batches": [
            {
                "batchId": "B-PROD-032-S",
                "variantSku": "GK-KTN",
                "expiryDate": "2027-12-31",
                "quantity": 6,
                "warehouse": "Sulur"
            },
            {
                "batchId": "B-PROD-032-SN",
                "variantSku": "GK-KTN",
                "expiryDate": "2027-12-31",
                "quantity": 5,
                "warehouse": "Singanallur"
            }
        ],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-033",
        "name": "PIVA GS10",
        "category": "Gaming Audio",
        "description": "PIVA professional sound enhancement system GS10",
        "unit": "Piece",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "PIVA-GS10",
                "name": "Standard Option",
                "barcode": "100033",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    },
    {
        "id": "PROD-034",
        "name": "PIVA GS20",
        "category": "Gaming Audio",
        "description": "PIVA high-end professional sound card interface GS20",
        "unit": "Piece",
        "initialStock": 1,
        "totalAdded": 0,
        "totalConsumed": 1,
        "variants": [
            {
                "sku": "PIVA-GS20",
                "name": "Standard Option",
                "barcode": "100034",
                "wholesalePrice": 50,
                "retailPrice": 90,
                "reorderLimit": 0,
                "stock": {
                    "Sulur": 0,
                    "Singanallur": 0
                }
            }
        ],
        "batches": [],
        "suppliers": [
            "SUP-01"
        ],
        "adjustments": []
    }
];

const defaultOrders = [
    {
        id: "ORD-9831",
        client: "Acme Departmental Store",
        date: "2026-06-25",
        items: [
            { variantSku: "MJ-CTC-35", quantity: 2, price: 90.00 },
            { variantSku: "MJ-CTC-DISP-1M", quantity: 3, price: 90.00 }
        ],
        totalValue: 450.00,
        warehouse: "Sulur",
        status: "Completed"
    },
    {
        id: "ORD-9832",
        client: "Orion Systems Coimbatore",
        date: "2026-06-27",
        items: [
            { variantSku: "ESG-2X1", quantity: 2, price: 90.00 },
            { variantSku: "BS-5PRO", quantity: 2, price: 90.00 }
        ],
        totalValue: 360.00,
        warehouse: "Singanallur",
        status: "Partially Delivered"
    },
    {
        id: "ORD-9833",
        client: "Apex Coffee Merchants",
        date: "2026-06-28",
        items: [
            { variantSku: "PIVA-B3", quantity: 5, price: 90.00 }
        ],
        totalValue: 450.00,
        warehouse: "Sulur",
        status: "Draft"
    },
    {
        id: "ORD-9834",
        client: "TechStyles Hub LLC",
        date: "2026-06-20",
        items: [
            { variantSku: "SFX-V10", quantity: 4, price: 90.00 }
        ],
        totalValue: 360.00,
        warehouse: "Singanallur",
        status: "Cancelled"
    }
];

const defaultActivities = [
    { type: "auth", description: "sfsf logged in to the dashboard.", time: "2026-06-29 17:40" },
    { type: "order", description: "Order ORD-9833 was generated as a Draft by Admin.", time: "2026-06-28 14:15" },
    { type: "stock", description: "FIFO Restocked: 50 units of Majentik added to Sulur branch.", time: "2026-06-27 11:32" },
    { type: "supplier", description: "Golden Thread outstanding liability paid in full.", time: "2026-06-26 09:44" }
];

const initialState = {
    products: defaultProducts,
    suppliers: defaultSuppliers,
    orders: defaultOrders,
    wastes: [
        { id: "WST-001", date: "2026-06-24", variantSku: "PIVA-B3", quantity: 1, warehouse: "Sulur", cost: 50.00, reporter: "sfsf" }
    ],
    activities: defaultActivities,
    storeSettings: {
        name: "o5taboad store",
        address: "Coimbatore, Tamil Nadu",
        currency: "EGP"
    },
    currentUser: null
};

export const AppProvider = ({ children }) => {
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem("octabot_state");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed &&
                    Array.isArray(parsed.products) &&
                    parsed.products.some(p => p.variants && p.variants.some(v => v.sku === "MJ-CTC-35")) &&
                    Array.isArray(parsed.suppliers) &&
                    Array.isArray(parsed.orders) &&
                    Array.isArray(parsed.wastes) &&
                    Array.isArray(parsed.activities) &&
                    parsed.storeSettings) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse localStorage state:", e);
        }
        return initialState;
    });

    const [currentView, setCurrentView] = useState("dashboard");
    const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
    const [language, setLanguage] = useState(() => localStorage.getItem("octabot_lang") || "en");
    const [theme, setTheme] = useState(() => localStorage.getItem("octabot_theme") || "dark");

    useEffect(() => {
        localStorage.setItem("octabot_lang", language);
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        document.documentElement.style.setProperty('--font-family-active', language === 'ar' ? "'Cairo'" : "'Inter'");
    }, [language]);

    useEffect(() => {
        localStorage.setItem("octabot_theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const t = (key) => {
        const tr = translations[language] && translations[language][key];
        return tr || key;
    };

    useEffect(() => {
        localStorage.setItem("octabot_state", JSON.stringify(state));
    }, [state]);

    const showToast = (message, type = "success") => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };

    const logActivity = (type, description) => {
        const time = new Date().toISOString().replace('T', ' ').substring(0, 16);
        setState(prev => {
            const activities = [{ type, description, time }, ...prev.activities];
            if (activities.length > 30) activities.pop();
            return { ...prev, activities };
        });
    };

    const authLogin = (username) => {
        const namePart = username.includes("@") ? username.split("@")[0] : username;
        const user = {
            name: namePart || "sfsf",
            role: "Store Manager",
            avatar: (namePart ? namePart.substring(0, 1).toUpperCase() : "A")
        };
        setState(prev => ({ ...prev, currentUser: user }));
        logActivity("auth", `User '${user.name}' signed in.`);
        showToast(`Welcome back, ${user.name}!`);
        setCurrentView("dashboard");
    };

    const authSignup = (storeName, email) => {
        const namePart = email.split("@")[0] || "Manager";
        const user = {
            name: namePart,
            role: "Octabot Admin",
            avatar: (storeName ? storeName.substring(0, 1).toUpperCase() : "O")
        };
        setState(prev => ({
            ...prev,
            currentUser: user,
            storeSettings: { ...prev.storeSettings, name: storeName }
        }));
        logActivity("auth", `Registered store and workspace for ${storeName}.`);
        showToast(`Store '${storeName}' Registered Successfully!`);
        setCurrentView("dashboard");
    };

    const authLogout = () => {
        setState(prev => ({ ...prev, currentUser: null }));
        showToast("Logged out successfully.");
    };

    // Products CRUD Actions
    const addProduct = (product) => {
        setState(prev => ({
            ...prev,
            products: [product, ...prev.products]
        }));
        logActivity("stock", `New product '${product.name}' was registered.`);
        showToast(`Product '${product.name}' added successfully.`);
    };

    const editProduct = (updatedProduct) => {
        setState(prev => ({
            ...prev,
            products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
        }));
        logActivity("stock", `Product '${updatedProduct.name}' details were updated.`);
        showToast(`Product '${updatedProduct.name}' updated.`);
    };

    const deleteProduct = (productId) => {
        const prod = state.products.find(p => p.id === productId);
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => p.id !== productId)
        }));
        if (prod) {
            logActivity("stock", `Product '${prod.name}' was deleted.`);
            showToast(`Product '${prod.name}' removed.`);
        }
    };

    const deleteMultipleProducts = (productIds) => {
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => !productIds.includes(p.id))
        }));
        logActivity("stock", `${productIds.length} products deleted in bulk.`);
        showToast(`${productIds.length} products deleted.`);
    };

    // Orders CRUD Actions
    const addOrder = (order) => {
        setState(prev => {
            let products = [...prev.products];
            if (order.status === "Completed" || order.status === "Partially Delivered") {
                order.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        if (stock[order.warehouse] !== undefined) {
                                            stock[order.warehouse] = Math.max(0, stock[order.warehouse] - item.quantity);
                                        } else {
                                            const keys = Object.keys(stock);
                                            if (keys.length > 0) {
                                                stock[keys[0]] = Math.max(0, stock[keys[0]] - item.quantity);
                                            }
                                        }
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }
            return {
                ...prev,
                products,
                orders: [order, ...prev.orders]
            };
        });
        logActivity("order", `New Order ${order.id} registered for ${order.client}.`);
        showToast(`Order ${order.id} recorded.`);
    };

    const updateOrderStatus = (orderId, newStatus) => {
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            if (!order) return prev;
            
            let products = [...prev.products];
            const oldStatus = order.status;
            
            const wasDeducted = oldStatus === "Completed" || oldStatus === "Partially Delivered";
            const isDeducted = newStatus === "Completed" || newStatus === "Partially Delivered";
            
            if (!wasDeducted && isDeducted) {
                order.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = order.warehouse || "Sulur";
                                        stock[wh] = Math.max(0, (stock[wh] || 0) - item.quantity);
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            } else if (wasDeducted && !isDeducted) {
                order.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = order.warehouse || "Sulur";
                                        stock[wh] = (stock[wh] || 0) + item.quantity;
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }

            return {
                ...prev,
                products,
                orders: prev.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
            };
        });
        logActivity("order", `Order ${orderId} status changed to ${newStatus}.`);
        showToast(`Order status updated to ${newStatus}.`);
    };

    const deleteOrder = (orderId) => {
        setState(prev => ({
            ...prev,
            orders: prev.orders.filter(o => o.id !== orderId)
        }));
        logActivity("order", `Order ${orderId} removed from records.`);
        showToast(`Order ${orderId} deleted.`);
    };

    // Suppliers CRUD Actions
    const addSupplier = (supplier) => {
        setState(prev => ({
            ...prev,
            suppliers: [supplier, ...prev.suppliers]
        }));
        logActivity("supplier", `Registered new supplier partner '${supplier.name}'.`);
        showToast(`Supplier '${supplier.name}' registered.`);
    };

    const recordSupplierPayment = (supplierId, amount) => {
        setState(prev => {
            const suppliers = prev.suppliers.map(s => {
                if (s.id === supplierId) {
                    const pay = Math.min(s.debt, amount);
                    return {
                        ...s,
                        paid: s.paid + pay,
                        debt: Math.max(0, s.debt - pay)
                    };
                }
                return s;
            });
            return { ...prev, suppliers };
        });
        const sup = state.suppliers.find(s => s.id === supplierId);
        if (sup) {
            logActivity("supplier", `Paid ${state.storeSettings.currency}${amount} to ${sup.name}.`);
            showToast(`Recorded payment of ${state.storeSettings.currency}${amount} to ${sup.name}.`);
        }
    };

    // Waste Logging
    const recordWaste = (waste) => {
        setState(prev => {
            let products = prev.products.map(p => {
                const hasVar = p.variants.some(v => v.sku === waste.variantSku);
                if (hasVar) {
                    return {
                        ...p,
                        variants: p.variants.map(v => {
                            if (v.sku === waste.variantSku) {
                                const stock = { ...v.stock };
                                stock[waste.warehouse] = Math.max(0, (stock[waste.warehouse] || 0) - waste.quantity);
                                return { ...v, stock };
                            }
                            return v;
                        })
                    };
                }
                return p;
            });

            return {
                ...prev,
                products,
                wastes: [waste, ...prev.wastes]
            };
        });
        logActivity("stock", `Waste Log: ${waste.quantity} units of ${waste.variantSku} flagged as waste (${waste.warehouse}).`);
        showToast(`Waste logged and deducted from stock.`);
    };

    // Store Configuration
    const saveStoreConfig = (name, address, currency) => {
        setState(prev => ({
            ...prev,
            storeSettings: { name, address, currency }
        }));
        logActivity("stock", `Updated configurations. Base currency: ${currency}.`);
        showToast("Store settings saved successfully.");
    };

    const restoreStoreData = (restoredState) => {
        if (restoredState.products && restoredState.suppliers && restoredState.orders) {
            setState(restoredState);
            logActivity("auth", "Database restored from file backup.");
            showToast("Database restored successfully!");
            setCurrentView("dashboard");
        } else {
            showToast("Invalid backup file format.", "error");
        }
    };

    const recordStockAdjustment = (productId, variantSku, warehouse, type, quantity, reason) => {
        setState(prev => {
            const products = prev.products.map(p => {
                if (p.id === productId) {
                    const variants = p.variants.map(v => {
                        if (v.sku === variantSku) {
                            const stock = { ...v.stock };
                            const amt = parseInt(quantity) || 0;
                            stock[warehouse] = Math.max(0, (stock[warehouse] || 0) + (type === 'increase' ? amt : -amt));
                            return { ...v, stock };
                        }
                        return v;
                    });
                    const adjLog = {
                        date: new Date().toISOString().substring(0, 10),
                        variantSku,
                        warehouse,
                        type,
                        quantity: parseInt(quantity) || 0,
                        reason: reason || "Manual Audit Correction"
                    };
                    const adjustments = p.adjustments ? [adjLog, ...p.adjustments] : [adjLog];
                    return { ...p, variants, adjustments };
                }
                return p;
            });
            return { ...prev, products };
        });
        const prod = state.products.find(p => p.id === productId);
        const name = prod ? prod.name : productId;
        logActivity("stock", `Manual Stock Adjustment for ${name} (${variantSku}): ${type === 'increase' ? '+' : '-'}${quantity} units at ${warehouse} branch. Reason: ${reason}`);
        showToast(`Stock adjusted successfully.`);
    };

    return (
        <AppContext.Provider value={{
            state,
            currentView,
            setCurrentView,
            toast,
            showToast,
            authLogin,
            authSignup,
            authLogout,
            addProduct,
            editProduct,
            deleteProduct,
            deleteMultipleProducts,
            addOrder,
            updateOrderStatus,
            deleteOrder,
            addSupplier,
            recordSupplierPayment,
            recordWaste,
            recordStockAdjustment,
            saveStoreConfig,
            restoreStoreData,
            logActivity,
            language,
            setLanguage,
            theme,
            setTheme,
            t
        }}>
            {children}
        </AppContext.Provider>
    );
};

const translations = {
    en: {
        dashboard: "Dashboard",
        inventory: "Inventory",
        reports: "Reports",
        suppliers: "Suppliers",
        orders: "Orders",
        manageStore: "Manage Store",
        settings: "Settings",
        logout: "Log Out",
        welcomeBack: "Welcome back",
        searchPlaceholder: "Search product, supplier, order...",
        noNotifications: "No new notifications",
        overallInventory: "Overall Inventory",
        categories: "Categories",
        totalProducts: "Total Products",
        topSelling: "Top Selling",
        lowStocks: "Low Stocks",
        revenue: "Revenue",
        cost: "Cost",
        notInStock: "Not in stock",
        ordered: "Ordered",
        products: "Products",
        addProduct: "Add Product",
        filters: "Filters",
        downloadAll: "Download all",
        buyingPrice: "Buying Price",
        quantity: "Quantity",
        thresholdValue: "Threshold Value",
        expiryDate: "Expiry Date",
        availability: "Availability",
        actions: "Actions",
        previous: "Previous",
        next: "Next",
        page: "Page",
        of: "of",
        newProduct: "New Product",
        productName: "Product Name",
        productId: "Product ID",
        unit: "Unit",
        discard: "Discard",
        overview: "Overview",
        totalProfit: "Total Profit",
        sales: "Sales",
        netPurchaseValue: "Net purchase value",
        netSalesValue: "Net sales value",
        momProfit: "MoM Profit",
        yoyProfit: "YoY Profit",
        bestSellingCategory: "Best selling category",
        bestSellingProduct: "Best selling product",
        profitAndRevenue: "Profit & Revenue",
        weekly: "Weekly",
        seeAll: "See All",
        inStock: "In-stock",
        outOfStock: "Out of stock",
        lowStock: "Low stock",
        packets: "Packets",
        units: "Units",
        brandName: "o5taboad sror",
        totalActiveSuppliers: "Total Active Suppliers",
        outstandingLiabilities: "Outstanding Liabilities",
        totalPaidAssets: "Total Paid Assets",
        productVarietiesRange: "Product Varieties Range",
        catalogItems: "catalog items",
        liabilityOutstanding: "Liability Outstanding",
        clearedLedger: "Cleared Ledger",
        payDebt: "Pay Debt",
        databaseMaintenance: "Database Backups & Exports",
        backupDescription: "Generate complete offline copies of your stock registries, transaction records, and activities lists. You can restore your data at any time from a JSON backup file.",
        downloadBackup: "Download JSON Database Backup",
        uploadBackup: "Upload JSON Database Restore",
        downloadCSV: "Download Catalog CSV Report",
        purchases: "Purchases",
        adjustments: "Adjustments",
        history: "History",
        supplierDetails: "Supplier Details",
        stockLocations: "Stock Locations",
        openingStock: "Opening Stock",
        onTheWay: "On the way",
        noRecords: "No records logged for this section under this tab.",
        chooseVariant: "-- Choose Variant --",
        orderTotal: "Estimated Order Total",
        orderedItems: "Ordered Items List",
        addItem: "Add Item",
        recordOrder: "Record Sales Order Transaction",
        customerName: "Buyer Client Name",
        fulfillmentWarehouse: "Fulfillment Warehouse Station",
        orderStatus: "Order Transaction Status",
        salesOverview: "Sales Overview",
        inventorySummary: "Inventory Summary",
        purchaseOverview: "Purchase Overview",
        productSummary: "Product Summary",
        totalProfit: "Total Profit",
        purchaseValue: "Net Purchase Value",
        salesValue: "Net Sales Value",
        momProfit: "MoM Profit",
        yoyProfit: "YoY Profit",
        bestSellingCategory: "Best Selling Category",
        turnover: "Turnover",
        increase: "Increase By",
        seeAll: "See All",
        profitAndRevenue: "Profit & Revenue",
        bestSellingProduct: "Best Selling Product",
        profit: "Profit",
        quantityInHand: "Quantity in Hand",
        toBeReceived: "To be received",
        purchase: "Purchase",
        cancel: "Cancel",
        return: "Return",
        numberOfSuppliers: "Number of Suppliers",
        numberOfCategories: "Number of Categories",
        topSellingStock: "Top Selling Stock",
        lowQuantityStock: "Low Quantity Stock",
        supplierName: "Supplier Name",
        contact: "Contact",
        status: "Status",
        email: "Email",
        phone: "Phone",
        paid: "Paid",
        debt: "Debt",
        addSupplier: "Add Supplier",
        registerNewSupplier: "Register New Supplier Profile",
        editSupplier: "Edit Supplier Profile",
        contactEmail: "Contact Email",
        contactPhone: "Contact Phone",
        paidBalance: "Paid Balance",
        outstandingDebt: "Outstanding Liability Debt",
        recordedCashPaid: "Recorded Cash Paid",
        orderId: "Order ID",
        date: "Date",
        customer: "Customer",
        total: "Total",
        payment: "Payment",
        newOrder: "New Order",
        save: "Save",
        cancelOrder: "Cancel Order",
        storeSettings: "Store Settings",
        storeName: "Store Name",
        currency: "Currency",
        saveSettings: "Save Settings",
        last7days: "Last 7 days",
        orderSummary: "Order Summary",
        salesAndPurchase: "Sales & Purchase",
        details: "Details",
        edit: "Edit",
        delete: "Delete",
        unitPrice: "Unit Price",
        wholesalePrice: "Wholesale Price",
        retailPrice: "Retail Price",
        reorderLimit: "Reorder Limit",
        barcode: "Barcode",
        description: "Description",
        allCategories: "All Categories",
        allWarehouses: "All Warehouses",
        inSulur: "In Sulur",
        inSinganallur: "In Singanallur",
        addVariant: "Add Variant",
        variants: "Variants",
        stock: "Stock",
        processStockReturn: "Process Stock Return",
        returnItemSku: "Return Item SKU",
        quantityToReturn: "Quantity to Return",
        itemCondition: "Item Condition Classification",
        restockable: "Restockable (FIFO)",
        damagedWaste: "Damaged / Waste Loss",
        noProducts: "No products found.",
        noOrders: "No orders found.",
        noSuppliers: "No suppliers found.",
        completed: "Completed",
        pending: "Pending",
        draft: "Draft",
        inspect: "Inspect",
        remaining: "Remaining",
        stockHealthy: "All stock levels healthy!",
        outOfStock: "Out of Stock",
        lowStock: "Low Stock",
        noItemsSold: "No items sold yet.",
        left: "left",
        name: "Name",
        price: "Price",
        soldQuantity: "Sold Quantity",
        remainingQuantity: "Remaining Quantity"
    },
    ar: {
        dashboard: "لوحة التحكم",
        inventory: "المستودع",
        reports: "التقارير",
        suppliers: "الموردين",
        orders: "المبيعات",
        manageStore: "إدارة المتجر",
        settings: "الإعدادات",
        logout: "تسجيل الخروج",
        welcomeBack: "مرحباً بك مجدداً",
        searchPlaceholder: "ابحث عن منتج، مورد، مبيعات...",
        noNotifications: "لا توجد تنبيهات جديدة",
        overallInventory: "حالة المخزن العامة",
        categories: "الأقسام",
        totalProducts: "إجمالي المنتجات",
        topSelling: "الأكثر مبيعاً",
        lowStocks: "مخزون منخفض",
        revenue: "الإيرادات",
        cost: "التكلفة",
        notInStock: "غير متوفر",
        ordered: "طلب شراء",
        products: "المنتجات",
        addProduct: "إضافة منتج",
        filters: "التصفيات",
        downloadAll: "تحميل الكل",
        buyingPrice: "سعر الشراء",
        quantity: "الكمية",
        thresholdValue: "الحد الأدنى",
        expiryDate: "تاريخ الانتهاء",
        availability: "الحالة",
        actions: "إجراءات",
        previous: "السابق",
        next: "التالي",
        page: "صفحة",
        of: "من",
        newProduct: "منتج جديد",
        productName: "اسم المنتج",
        productId: "كود المنتج",
        unit: "الوحدة",
        discard: "تجاهل",
        overview: "نظرة عامة",
        totalProfit: "إجمالي الأرباح",
        sales: "المبيعات",
        netPurchaseValue: "صافي المشتريات",
        netSalesValue: "صافي المبيعات",
        momProfit: "الربح الشهري",
        yoyProfit: "الربح السنوي",
        bestSellingCategory: "الأقسام الأكثر مبيعاً",
        bestSellingProduct: "المنتجات الأكثر مبيعاً",
        profitAndRevenue: "الربح والإيرادات",
        weekly: "أسبوعي",
        seeAll: "عرض الكل",
        inStock: "متوفر",
        outOfStock: "نفذ المخزن",
        lowStock: "مخزون منخفض",
        packets: "علبة",
        units: "وحدة",
        brandName: "متجر أخطبوط",
        totalActiveSuppliers: "إجمالي الموردين النشطين",
        outstandingLiabilities: "المستحقات المعلقة",
        totalPaidAssets: "إجمالي المدفوعات",
        productVarietiesRange: "تنوع المنتجات",
        catalogItems: "أصناف",
        liabilityOutstanding: "مستحقات معلقة",
        clearedLedger: "حساب مصفى",
        payDebt: "دفع المستحق",
        databaseMaintenance: "نسخ احتياطي واستعادة البيانات",
        backupDescription: "قم بإنشاء نسخ احتياطية كاملة من سجلات المنتجات، الطلبات، والأنشطة للعمل بدون اتصال. يمكنك استعادة بياناتك في أي وقت من ملف النسخة الاحتياطية.",
        downloadBackup: "تحميل نسخة JSON الاحتياطية",
        uploadBackup: "رفع واستعادة ملف JSON",
        downloadCSV: "تحميل تقرير الأصناف CSV",
        purchases: "المشتريات",
        adjustments: "التسويات",
        history: "السجل",
        supplierDetails: "تفاصيل المورد",
        stockLocations: "مواقع المخزون",
        openingStock: "الرصيد الافتتاحي",
        onTheWay: "في الطريق",
        noRecords: "لا توجد سجلات مضافة لهذا القسم تحت هذا التبويب.",
        chooseVariant: "-- اختر الصنف --",
        orderTotal: "إجمالي قيمة الطلب",
        orderedItems: "قائمة المنتجات المطلوبة",
        addItem: "إضافة منتج",
        recordOrder: "تسجيل معاملة طلب مبيعات",
        customerName: "اسم العميل المشتري",
        fulfillmentWarehouse: "مستودع الشحن والتسليم",
        orderStatus: "حالة معاملة الطلب",
        salesOverview: "نظرة عامة على المبيعات",
        inventorySummary: "ملخص المستودع",
        purchaseOverview: "نظرة عامة على المشتريات",
        productSummary: "ملخص المنتجات",
        totalProfit: "إجمالي الأرباح",
        purchaseValue: "صافي قيمة المشتريات",
        salesValue: "صافي قيمة المبيعات",
        momProfit: "أرباح الشهر الماضي مقارنة بالماضي",
        yoyProfit: "أرباح السنة مقارنة بالماضي",
        bestSellingCategory: "الأقسام الأكثر مبيعاً",
        turnover: "حجم المبيعات",
        increase: "الزيادة",
        seeAll: "عرض الكل",
        profitAndRevenue: "الأرباح والإيرادات",
        bestSellingProduct: "المنتجات الأكثر مبيعاً",
        profit: "الأرباح",
        quantityInHand: "الكمية المتوفرة",
        toBeReceived: "بانتظار الاستلام",
        purchase: "المشتريات",
        cancel: "الملغاة",
        return: "المرتجعة",
        numberOfSuppliers: "عدد الموردين",
        numberOfCategories: "عدد الأقسام",
        topSellingStock: "المنتجات الأكثر مبيعاً",
        lowQuantityStock: "منتجات منخفضة الكمية",
        supplierName: "اسم المورد",
        contact: "الاتصال",
        status: "الحالة",
        email: "البريد الإلكتروني",
        phone: "الهاتف",
        paid: "المدفوع",
        debt: "المستحق",
        addSupplier: "إضافة مورد",
        registerNewSupplier: "تسجيل ملف مورد جديد",
        editSupplier: "تعديل ملف المورد",
        contactEmail: "البريد الإلكتروني للاتصال",
        contactPhone: "رقم هاتف الاتصال",
        paidBalance: "الرصيد المدفوع",
        outstandingDebt: "الالتزامات المالية المستحقة",
        recordedCashPaid: "المبلغ النقدي المسجل المدفوع",
        orderId: "رقم الطلب",
        date: "التاريخ",
        customer: "العميل",
        total: "الإجمالي",
        payment: "الدفع",
        newOrder: "طلب جديد",
        save: "حفظ",
        cancelOrder: "إلغاء الطلب",
        storeSettings: "إعدادات المتجر",
        storeName: "اسم المتجر",
        currency: "العملة",
        saveSettings: "حفظ الإعدادات",
        last7days: "آخر 7 أيام",
        orderSummary: "ملخص الطلبات",
        salesAndPurchase: "المبيعات والمشتريات",
        details: "التفاصيل",
        edit: "تعديل",
        delete: "حذف",
        unitPrice: "سعر الوحدة",
        wholesalePrice: "سعر الجملة",
        retailPrice: "سعر التجزئة",
        reorderLimit: "حد إعادة الطلب",
        barcode: "باركود",
        description: "الوصف",
        allCategories: "كل الأقسام",
        allWarehouses: "كل المستودعات",
        inSulur: "في السلور",
        inSinganallur: "في سينجانالور",
        addVariant: "إضافة نوع",
        variants: "الأنواع",
        stock: "المخزون",
        processStockReturn: "معالجة مرتجع المخزون",
        returnItemSku: "رمز صنف المرتجع (SKU)",
        quantityToReturn: "الكمية المرتجعة",
        itemCondition: "تصنيف حالة المنتج",
        restockable: "قابل لإعادة البيع (FIFO)",
        damagedWaste: "تالف / فاقد هدر",
        noProducts: "لم يتم العثور على منتجات.",
        noOrders: "لم يتم العثور على طلبات.",
        noSuppliers: "لم يتم العثور على موردين.",
        completed: "مكتمل",
        pending: "قيد الانتظار",
        draft: "مسودة",
        inspect: "معاينة",
        remaining: "المتبقي",
        stockHealthy: "كل مستويات المخزون سليمة!",
        outOfStock: "نفد من المخزن",
        lowStock: "مخزون منخفض",
        noItemsSold: "لم يتم بيع أي منتجات بعد.",
        left: "متبقي",
        name: "الاسم",
        price: "السعر",
        soldQuantity: "الكمية المباعة",
        remainingQuantity: "الكمية المتبقية"
    }
};
