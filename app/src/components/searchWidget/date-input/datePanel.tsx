import * as React from 'react';
import './dateInput.scss';
import ExpandedDatePanel from './expandedDatePanel'

class DatePanel extends React.Component<any, any> {

    private datePanelWrapper: React.RefObject<HTMLInputElement> | undefined;

    bindHandleOutsideClick(event: any) { }

    constructor(props: any) {
        super(props);
        this.state = {
            isHidden: true
        };

        this.datePanelWrapper = React.createRef();
        this.bindHandleOutsideClick = this.handleOutsideClick.bind(this);
    };

    componentWillMount() {
        document.addEventListener('click', this.bindHandleOutsideClick, false);
    }

    componentWillUnmount() {
        document.removeEventListener('click', this.bindHandleOutsideClick, false);
    }

    toggleHidden(event:any) {
        event.preventDefault();
        this.setState({
            isHidden: !this.state.isHidden
        });
    };

    handleOutsideClick(event: any) {
        if (!this.state.isHidden &&
            this.datePanelWrapper && this.datePanelWrapper.current
            && !this.datePanelWrapper.current.contains(event.target)) {

            event.preventDefault();
            event.stopPropagation();

            this.setState({
                isHidden: true
            });
        }
    }

    render() {
        return (
            <div>
                <div className='date-panel-wrapper' ref={this.datePanelWrapper}>
                    <div className='date-panel-collapsed' onClick={this.toggleHidden.bind(this)}>
                        Weekend trip on August
                    </div>
                    {!this.state.isHidden && (
                        <ExpandedDatePanel />
                    )}
                </div>
            </div>
        );
    };
}

export default DatePanel