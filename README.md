# Circuit Simulator

This project is a circuit simulator with a RESTful API. It allows you to create, manage, and simulate digital logic circuits.

## Setup

### Prerequisites

- Python 3.6+
- pip

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```bash
   cd <project-directory>
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

To run the application, execute the following command:
```bash
python app.py
```

## Usage

The API allows you to create, manage, and simulate circuits.

### Create a Circuit

- **URL**: `/api/circuits`
- **Method**: `POST`
- **Data**:
  ```json
  {
    "name": "MyCircuit",
    "gates": [],
    "connections": [],
    "inputs": [],
    "outputs": []
  }
  ```

### Get All Circuits

- **URL**: `/api/circuits`
- **Method**: `GET`

### Get a Specific Circuit

- **URL**: `/api/circuits/<circuit_name>`
- **Method**: `GET`

### Simulate a Circuit

- **URL**: `/api/circuits/simulate`
- **Method**: `POST`
- **Data**:
  ```json
  {
    "circuit": {
      "name": "MyCircuit",
      "gates": [],
      "connections": []
    },
    "inputs": {}
  }
  ```
