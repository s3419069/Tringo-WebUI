import * as React from 'react';
import { connect } from 'react-redux';
import GoogleMapReact, { ChangeEventValue, MapTypeStyle } from 'google-map-react';
import { DestinationProp, PriceTagMarker } from 'components/markers/priceTagMarker';
import DepartureMarker from 'components/markers/departureMarker';
import TinyPinMarker from 'components/markers/tinyPinMarker';
import { IDestination } from 'models/response/destination';
import * as destinationActions from 'actions/destinations';
import SearchWidgetWrapper from 'components/searchWidget/searchWidgetWrapper';
import { FlightDestinationRequest, MapArea } from 'models/request/flightDestinationRequest';
import { DatesInput } from 'models/request/dateInput';
import gMapConf from './gMapConf.json';
import { DestinationsState } from 'models/response/destinations';
import { LinearProgress, withStyles } from '@material-ui/core';
import { fetchDepartureAirport } from 'services/dataService';

import './googleMap.scss';

interface MapProp {
    error?: string;
    isLoading?: boolean;
    maxNumberOfConcurrentPriceMarkers: number;
    destinations: IDestination[];
    fetchDestinations: (arg: FlightDestinationRequest) => {};
}

type DrawerSide = 'cooperative' | 'auto';

interface MapState {
    center: {
        lat: number;
        lng: number;
    };
    mapProps: MapInitProps;
    destinationsRequestModel: FlightDestinationRequest;
    isLoading?: boolean;
    error?: string;
    selectedAirportlabel: string;
    departureAirportCode: string;
    departureLat: number;
    departureLng: number;
}

interface MapInitProps {
    defaultZoom: number;
    zoomControl: boolean;
    scrollwheel: boolean;
    gestureHandling: DrawerSide;
}

interface GoogleMapObj {
    map: { zoom: number };
    maps: { Polyline: any };
}

interface IDestinationGroup {
    key: IDestination;
    values: DestinationProp[];
}

const ColorLinearProgress = withStyles({
    colorPrimary: {
        backgroundColor: '#cccccc'
    },
    barColorPrimary: {
        backgroundColor: '#999'
    }
})(LinearProgress);

class SimpleMap extends React.Component<MapProp, MapState> {
    public static IsMobile(): boolean {
        return window.screen.width < parseInt(process.env.REACT_APP_MOBILE_WIDTH || '');
    }

    private static mapInitProp = (): MapInitProps =>
        SimpleMap.IsMobile()
            ? {
                defaultZoom: gMapConf.defaultMobileZoom as number,
                zoomControl: false,
                scrollwheel: false,
                gestureHandling: 'cooperative'
            }
            : {
                defaultZoom: gMapConf.defaultDesktopZoom as number,
                zoomControl: true,
                scrollwheel: true,
                gestureHandling: 'auto'
            };
    
    private googleMaps?: GoogleMapObj;
    private flightPathPolyLine: any;
    
    constructor(props: any) {
        super(props);
        // no matters what MapArea at this point at all,
        // we set lat/lng and zoom for component directly and it will be overridden
        this.state = {
            mapProps: SimpleMap.mapInitProp(),
            center: gMapConf.defaultCentre,
            destinationsRequestModel: new FlightDestinationRequest(
                process.env.REACT_APP_DEFAULT_DEPARTURE || '',
                MapArea.createRandom(),
                null,
                new DatesInput(-1)
            ),
            selectedAirportlabel: process.env.REACT_APP_DEFAULT_DEPARTURE_LABEL || '',
            departureAirportCode: process.env.REACT_APP_DEFAULT_DEPARTURE || '',
            departureLat: process.env.REACT_APP_DEFAULT_DEPARTURE_LAT ?
                parseInt(process.env.REACT_APP_DEFAULT_DEPARTURE_LAT) : 0,
            departureLng: process.env.REACT_APP_DEFAULT_DEPARTURE_LNG ?
                parseInt(process.env.REACT_APP_DEFAULT_DEPARTURE_LNG) : 0
        };
        
        this.requestDestinationsUpdate = this.requestDestinationsUpdate.bind(this);
        this.mapChanged = this.mapChanged.bind(this);
        this.onGoogleApiLoaded = this.onGoogleApiLoaded.bind(this);
        this.drawPolyLine = this.drawPolyLine.bind(this);
        this.cleanupPolyLines = this.cleanupPolyLines.bind(this);
        this.updateDepartureAirport = this.updateDepartureAirport.bind(this);
        this.setDepartureCoordinates = this.setDepartureCoordinates.bind(this);
        SimpleMap.IsMobile = SimpleMap.IsMobile.bind(this);
    }
    
    onGoogleApiLoaded(maps: GoogleMapObj) {
        this.googleMaps = maps;
    }
    
    drawPolyLine(destLat: number, destLng: number): void {
        if (!this.googleMaps) {
            return;
        }
        
        const pointsline = [{ lat: destLat, lng: destLng }, { lat: -33.8688, lng: 151.2093 }];
        this.flightPathPolyLine = new this.googleMaps.maps.Polyline({
            path: pointsline,
            geodesic: true,
            strokeColor: '#454545',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        this.flightPathPolyLine.setMap(this.googleMaps.map);
    }
    
    cleanupPolyLines(): void {
        if (this.flightPathPolyLine) {
            this.flightPathPolyLine.setMap(null);
        }
    }
    
    renderDestinations() {
        const dests = this.props.destinations;
        if (!dests) {
            return '';
        }
        const noPriceDests = dests.filter(d => d.price === -1);
        const hasPriceDests = dests.filter(d => d.price !== -1);
        const sortedDests = hasPriceDests.sort((a: IDestination, b: IDestination) => {
            // sorting by descending
            if (a.personalPriorityIdx < b.personalPriorityIdx) {
                return 1;
            }
            if (a.personalPriorityIdx > b.personalPriorityIdx) {
                return -1;
            }
            return 0;
        });
        const groupedDests = this.groupDestinations(hasPriceDests);
        return groupedDests
            .map((group: { key: IDestination; values: DestinationProp[] }, idx: number) => {
                const record = group.key;
                if (
                    record.lat === undefined ||
                    record.lng === undefined ||
                    record.price === undefined ||
                    record.personalPriorityIdx === undefined ||
                    record.cityName === undefined
                ) {
                    return '';
                }
                if (sortedDests.indexOf(record) > this.props.maxNumberOfConcurrentPriceMarkers) {
                    return (
                        <TinyPinMarker
                            key={idx}
                            lat={record.lat} // to be consumed only by Maps API
                            lng={record.lng} // to be consumed only by Maps API
                        />
                    );
                }
                return (
                    <PriceTagMarker
                        key={idx}
                        lat={record.lat} // to be consumed only by Maps API
                        lng={record.lng} // to be consumed only by Maps API
                        // properties used by marker component properties:
                        destinations={group.values}
                        fromCode={this.state.destinationsRequestModel.departureAirportId}
                        fromLabel={this.state.selectedAirportlabel ? this.state.selectedAirportlabel : ''}
                        onMouseEnter={() => {
                            this.drawPolyLine(record.lat, record.lng);
                        }}
                        onMouseLeave={this.cleanupPolyLines}
                    />
                );
            })
            .concat(
                noPriceDests.map((d: IDestination, idx: number) => {
                    return (
                        <TinyPinMarker
                            key={groupedDests.length + idx}
                            lat={d.lat} // to be consumed only by Maps API
                            lng={d.lng} // to be consumed only by Maps API
                            disabled={true}
                        />
                    );
                })
            );
    }
    
    setDepartureCoordinates(values?: number[]) {
        if (values && values.length === 2) {
            this.setState(
                {
                    departureLat: values[0],
                    departureLng: values[1]
                }
            );
        }
    }
    
    renderDepartureAirport() {
        fetchDepartureAirport(this.state.departureAirportCode, this.setDepartureCoordinates);
        return (
            <DepartureMarker
                key={-33.8688}
                lat={this.state.departureLat} // to be consumed only by Maps API
                lng={this.state.departureLng} // to be consumed only by Maps API
            />
        );
    }
    
    areDestinationsCloseEnough(d1: IDestination, d2: IDestination): boolean {
        if (!this.googleMaps) {
            return d1.lat === d2.lat && d1.lng === d2.lng;
        } //if something is wrong, just don't show clusterization
        
        // TODO: use advanced clusterization algorithm. while 4/zl should be ok for the beginning
        const zoomLevel = this.googleMaps.map.zoom; // int numbers, for instance: 7 (close), 6, 5, 4, 3 (far away)
        const maxDiffLat = 8 / zoomLevel;
        const maxDiffLlg = 16 / zoomLevel;

        return Math.abs(d1.lat - d2.lat) < maxDiffLat && Math.abs(d1.lng - d2.lng) < maxDiffLlg;
    }
    
    groupDestinations(dests: IDestination[]): IDestinationGroup[] {
        const self = this;
        const group = dests.reduce(function(storage: IDestinationGroup[], item: IDestination) {
            // get the first instance of the key by which we're grouping
            const existingStorageItem = storage.find(g => self.areDestinationsCloseEnough(g.key, item));
            if (existingStorageItem) {
                existingStorageItem.values.push({
                    destination: item.airportName ? item.airportName : item.cityName,
                    destinationCode: item.destAirportCode,
                    priority: item.personalPriorityIdx,
                    dateOut: item.flightDates.departureDate,
                    dateBack: item.flightDates.returnDate,
                    price: item.price
                });
            } else {
                // set `storage` for this instance of group to the outer scope (if not empty) or initialize it
                storage.push({
                    key: item,
                    values: [
                        {
                            destination: item.cityName,
                            destinationCode: item.destAirportCode,
                            priority: item.personalPriorityIdx,
                            dateOut: item.flightDates.departureDate,
                            dateBack: item.flightDates.returnDate,
                            price: item.price
                        }
                    ]
                });
            }
            // return the updated storage to the reduce function, which will then loop through the next
            return storage;
        }, []);
        return group;
    }
    
    updateDepartureAirport(departureAirportCode: string) {
        this.setState({
            departureAirportCode: departureAirportCode ? departureAirportCode : ''
        });
    }
    
    requestDestinationsUpdate(model: FlightDestinationRequest, selectedAirportLabel: string | null) {
        this.setState({
            destinationsRequestModel: model,
            isLoading: model.departureAirportId != null
        });
        
        this.setState({
            selectedAirportlabel: selectedAirportLabel ? selectedAirportLabel : ''
        });
        
        // initiate fetching destinations here
        this.props.fetchDestinations(this.state.destinationsRequestModel);
    }
    
    // mapChanged. Get fired on: drag end/zoom/on initial load
    mapChanged(changeEvent: ChangeEventValue) {
        const currentMode = this.state.destinationsRequestModel;
        currentMode.searchArea.nw = changeEvent.marginBounds.nw;
        currentMode.searchArea.se = changeEvent.marginBounds.se;

        // google-map-react does not reset Lng when moving accross pacific ocean. So let's do it manually
        if (currentMode.searchArea.nw.lng > 180) currentMode.searchArea.nw.lng -= 360;
        if (currentMode.searchArea.se.lng > 180) currentMode.searchArea.se.lng -= 360;
        if (currentMode.searchArea.nw.lng < -180) currentMode.searchArea.nw.lng += 360;
        if (currentMode.searchArea.se.lng < -180) currentMode.searchArea.se.lng += 360;

        this.requestDestinationsUpdate(currentMode, this.state.selectedAirportlabel);
        if (this.flightPathPolyLine) {
            this.flightPathPolyLine.setMap(null);
        }
    }
    
    render() {
        return (
            <div>
                <GoogleMapReact
                    bootstrapURLKeys={{
                        key: 'AIzaSyCYHeC_ETn53YOfjFKM7jSh6-diOCPTEGs',
                        language: 'en'
                    }}
                    defaultCenter={this.state.center}
                    defaultZoom={this.state.mapProps.defaultZoom}
                    style={{ height: '100%', width: '100%' }}
                    onChange={this.mapChanged}
                    onGoogleApiLoaded={this.onGoogleApiLoaded}
                    yesIWantToUseGoogleMapApiInternals={true} // because we want to access PolyLine
                    options={{
                        fullscreenControl: true,
                        fullscreenControlOptions: {
                            position: 6
                        },
                        gestureHandling: 'cooperative',
                        maxZoom: this.state.mapProps.defaultZoom * 3,
                        minZoom: this.state.mapProps.defaultZoom * 0.8,
                        minZoomOverride: true,
                        // disableDefaultUI: true,
                        zoomControl: this.state.mapProps.zoomControl,
                        scrollwheel: this.state.mapProps.scrollwheel,
                        styles: gMapConf.styles as MapTypeStyle[]
                    }}
                >
                    {this.renderDestinations()}
                    {this.renderDepartureAirport()}
                </GoogleMapReact>
                <SearchWidgetWrapper
                    onChange={this.requestDestinationsUpdate}
                    initialModel={this.state.destinationsRequestModel}
                />
                {this.props.isLoading && (
                    <div className="loader-container">
                        <ColorLinearProgress/>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state: { destinationsReducer: DestinationsState }) => {
    return {
        destinations: state.destinationsReducer.destinations,
        isLoading: state.destinationsReducer.isLoading,
        error: state.destinationsReducer.error
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return {
        fetchDestinations: (model: FlightDestinationRequest) =>
            dispatch(destinationActions.fetchDestinationsStart(model))
    };
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SimpleMap);
