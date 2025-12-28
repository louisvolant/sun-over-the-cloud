# Sun Over The Cloud - Weather Application

## Overview
Sun Over The Cloud is a comprehensive weather application built with Next.js that provides current weather conditions, forecasts, and historical weather data visualization. The application offers an intuitive interface for searching locations and viewing detailed weather information including precipitation, humidity, and cloud cover data.

## Features
- **Location Search**: Search for any city worldwide
- **Current Weather**: View detailed current weather conditions including:
    - Temperature and feels like temperature
    - Wind speed and direction
    - Cloud coverage
    - Visibility
    - Sunrise and sunset times
    - Humidity and pressure
- **Weather Forecast**: Access detailed weather forecasts with:
    - Temperature predictions
    - Humidity levels
    - Wind conditions
    - Precipitation probability
    - Cloud coverage
- **Historical Weather Data**: Visualize historical weather data with interactive charts:
    - Precipitation data
    - Humidity levels
    - Cloud cover patterns
- **Customizable Time Range**: Adjust the number of days for historical data viewing

## Technical Stack
- Next.js (React framework)
- Recharts for data visualization
- Tailwind CSS for styling
- Environment variables for backend configuration

## Setup

### Prerequisites
- Node.js (latest stable version)
- npm or yarn
- A backend service configured with weather API integration

### Installation
1. Clone the repository:
```bash
git clone [repository-url]
cd sun-over-the-cloud
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment variables:
   Create a `.env.local` file in the root directory and add:
```
BACKEND_URL=your_backend_url
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage
1. Enter a city name in the search bar
2. Select the correct location from the search results
3. View current weather information
4. Click "Show weather forecast" to see future predictions
5. Use the "View last X days of precipitation" feature to see historical data
6. Adjust the number of days for historical data using the days input

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.