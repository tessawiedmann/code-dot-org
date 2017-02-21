/**
 * A React component for our JavaScript debugger UI. Returns a connected component
 * so this can only be used in cases where we have a redux store.
 */

import React, {PropTypes} from 'react';
import {connect} from 'react-redux';
import $ from 'jquery';

import i18n from '@cdo/locale';
import Radium from 'radium';
import dom from '../../../dom';
import commonStyles from '../../../commonStyles';
import styleConstants from '../../../styleConstants';
import {ConnectedWatchers} from '../../../templates/watchers/Watchers';
import PaneHeader from '../../../templates/PaneHeader';
const {PaneSection, PaneButton} = PaneHeader;
import SpeedSlider from '../../../templates/SpeedSlider';
import FontAwesome from '../../../templates/FontAwesome';
import {setStepSpeed} from '../../../redux/runState';
import ProtectedStatefulDiv from '../../../templates/ProtectedStatefulDiv';
import * as utils from '../../../utils';
import {
  add as addWatchExpression,
  remove as removeWatchExpression
} from '../../../redux/watchedExpressions';
import DebugConsole from './DebugConsole';
import DebugButtons from './DebugButtons';

import {
  // actions
  clearLog,

  // selectors
  isAttached,
  canRunNext,
  getCommandHistory,
} from './redux';

var styles = {
  debugAreaHeader: {
    position: 'absolute',
    top: styleConstants['resize-bar-width'],
    left: 0,
    right: 0,
    textAlign: 'center',
    lineHeight: '30px'
  },
  noPadding: {
    padding: 0
  },
  noUserSelect: {
    MozUserSelect: 'none',
    WebkitUserSelect: 'none',
    msUserSelect: 'none',
    userSelect: 'none',
  },
  showHideIcon: {
    position: 'absolute',
    top: 0,
    left: 8,
    margin: 0,
    lineHeight: styleConstants['workspace-headers-height'] + 'px',
    fontSize: 18,
    ':hover': {
      cursor: 'pointer',
      color: 'white'
    }
  },
  showDebugWatchIcon: {
    position: 'absolute',
    top: 0,
    right: '6px',
    width: '18px',
    margin: 0,
    lineHeight: styleConstants['workspace-headers-height'] + 'px',
    fontSize: 18,
    ':hover': {
      cursor: 'pointer',
      color: 'white'
    }
  }
};

const MIN_DEBUG_AREA_HEIGHT = 120;
const MAX_DEBUG_AREA_HEIGHT = 400;
const MIN_WATCHERS_AREA_WIDTH = 120;
const MAX_WATCHERS_AREA_WIDTH = 400;

/**
 * The parent JsDebugger component.
 */
export const UnconnectedJsDebugger = Radium(React.createClass({
  propTypes: {
    // from redux
    debugButtons: PropTypes.bool.isRequired,
    debugConsole: PropTypes.bool.isRequired,
    debugWatch: PropTypes.bool.isRequired,
    debugSlider: PropTypes.bool.isRequired,
    isDebuggerPaused: PropTypes.bool.isRequired,
    stepSpeed: PropTypes.number.isRequired,
    isAttached: PropTypes.bool.isRequired,
    canRunNext: PropTypes.bool.isRequired,
    setStepSpeed: PropTypes.func.isRequired,
    clearLog: PropTypes.func.isRequired,

    // passed from above
    onSlideShut: PropTypes.func,
    onSlideOpen: PropTypes.func,
    style: PropTypes.object,
  },

  getInitialState() {
    return {
      watchersHidden: false,
      open: true,
    };
  },

  componentDidMount() {
    // TODO: probably need to put this somehwere...
//    this.props.debuggerUi.setStepSpeed(this.props.stepSpeed);

    const mouseUpTouchEventName = dom.getTouchEventName('mouseup');

    // Attach handlers for the debug area resize control
    // Can't use dom.addMouseUpTouchEvent() because it will preventDefault on
    // all touchend events on the page, breaking click events...
    document.body.addEventListener(
      'mouseup',
      this.onMouseUpDebugResizeBar
    );
    if (mouseUpTouchEventName) {
      document.body.addEventListener(
        mouseUpTouchEventName,
        this.onMouseUpDebugResizeBar
      );
    }

    // Can't use dom.addMouseUpTouchEvent() because it will preventDefault on
    // all touchend events on the page, breaking click events...
    document.body.addEventListener(
      'mouseup',
      this.onMouseUpWatchersResizeBar
    );
    if (mouseUpTouchEventName) {
      document.body.addEventListener(
        mouseUpTouchEventName,
        this.onMouseUpWatchersResizeBar
      );
    }

    let watchersReferences = {};
    function getWatchersElements() {
      watchersReferences.watchersResizeBar = (
        watchersReferences.watchersResizeBar ||
        document.getElementById('watchersResizeBar')
      );
      watchersReferences.watchersDiv = (
        watchersReferences.watchersDiv ||
        document.getElementById('debug-watch')
      );
      watchersReferences.watchersHeaderDiv = (
        watchersReferences.watchersHeaderDiv ||
        document.getElementById('debug-watch-header')
      );
      watchersReferences.debugConsoleDiv = (
        watchersReferences.debugConsoleDiv ||
        document.getElementById('debug-console')
      );
      return watchersReferences;
    }

    document.addEventListener('resetWatchersResizableElements', () => {
      const elements = getWatchersElements();
      elements.watchersDiv.style.removeProperty('width');
      elements.debugConsoleDiv.style.removeProperty('right');
      elements.watchersResizeBar.style.removeProperty('right');
      elements.watchersHeaderDiv.style.removeProperty('width');

      watchersReferences = {};
    });

  },

  onMouseUpDebugResizeBar(e) {
    // If we have been tracking mouse moves, remove the handler now:
    if (this._draggingDebugResizeBar) {
      document.body.removeEventListener('mousemove', this.onMouseMoveDebugResizeBar);
      const mouseMoveTouchEventName = dom.getTouchEventName('mousemove');
      if (mouseMoveTouchEventName) {
        document.body.removeEventListener(
          mouseMoveTouchEventName,
          this.onMouseMoveDebugResizeBar
        );
      }
      this._draggingDebugResizeBar = false;
    }
  },

  isOpen() {
    return this.state.open;
  },

  slideShut() {
    const closedHeight = $(this.root).find('#debug-area-header').height() +
                         $(this._debugResizeBar).height();
    this.setState({
      transitionType: 'closing',
      open: false,
      openedHeight: $(this.root).height(),
      closedHeight,
    });
    this.props.onSlideShut && this.props.onSlideShut(closedHeight);
  },

  slideOpen() {
    this.setState({
      open: true,
      transitionType: 'opening',
    });
    this.props.onSlideOpen && this.props.onSlideOpen(this.state.openedHeight);
  },

  slideToggle() {
    if (this.state.open) {
      this.slideShut();
    } else {
      this.slideOpen();
    }
  },

  onTransitionEnd() {
    this.setState({transitionType: null});
  },

  onMouseDownDebugResizeBar(event) {
    // When we see a mouse down in the resize bar, start tracking mouse moves:
    var eventSourceElm = event.srcElement || event.target;
    if (eventSourceElm.id === 'debugResizeBar') {
      this._draggingDebugResizeBar = true;
      document.body.addEventListener('mousemove', this.onMouseMoveDebugResizeBar);
      const mouseMoveTouchEventName = dom.getTouchEventName('mousemove');
      if (mouseMoveTouchEventName) {
        document.body.addEventListener(
          mouseMoveTouchEventName,
          this.onMouseMoveDebugResizeBar
        );
      }

      event.preventDefault();
    }
  },

  /**
   *  Handle mouse moves while dragging the debug resize bar.
   */
  onMouseMoveDebugResizeBar(event) {
    var codeApp = document.getElementById('codeApp');
    var codeTextbox = document.getElementById('codeTextbox');

    var resizeBar = this._debugResizeBar;
    var rect = resizeBar.getBoundingClientRect();
    var offset = (parseInt(window.getComputedStyle(codeApp).bottom, 10) || 0) -
                 rect.height / 2;
    var newDbgHeight = Math.max(
      MIN_DEBUG_AREA_HEIGHT,
      Math.min(
        MAX_DEBUG_AREA_HEIGHT,
        (window.innerHeight - event.pageY) - offset
      )
    );

    if (!this.isOpen()) {
      this.slideOpen();
    }

    codeTextbox.style.bottom = newDbgHeight + 'px';
    this.root.style.height = newDbgHeight + 'px';

    // Fire resize so blockly and droplet handle this type of resize properly:
    utils.fireResizeEvent();
  },

  onMouseDownWatchersResizeBar(event) {
    // When we see a mouse down in the resize bar, start tracking mouse moves:
    var eventSourceElm = event.srcElement || event.target;
    if (eventSourceElm.id === 'watchersResizeBar') {
      this._draggingWatchersResizeBar = true;
      document.body.addEventListener('mousemove', this.onMouseMoveWatchersResizeBar);
      const mouseMoveTouchEventName = dom.getTouchEventName('mousemove');
      if (mouseMoveTouchEventName) {
        document.body.addEventListener(
          mouseMoveTouchEventName,
          this.onMouseMoveWatchersResizeBar
        );
      }

      event.preventDefault();
    }
  },

  onMouseUpWatchersResizeBar() {
    // If we have been tracking mouse moves, remove the handler now:
    if (this._draggingWatchersResizeBar) {
      document.body.removeEventListener('mousemove', this.onMouseMoveWatchersResizeBar);
      const mouseMoveTouchEventName = dom.getTouchEventName('mousemove');
      if (mouseMoveTouchEventName) {
        document.body.removeEventListener(
          mouseMoveTouchEventName,
          this.onMouseMoveWatchersResizeBar
        );
      }
      this._draggingWatchersResizeBar = false;
    }
  },

  /**
   *  Handle mouse moves while dragging the debug resize bar.
   */
  onMouseMoveWatchersResizeBar(event) {
    const watchers = this._watchers.getWrappedInstance();
    const watchersRect = watchers.scrollableContainer.getBoundingClientRect();
    const movement = watchersRect.left - event.clientX;
    const newDesiredWidth = watchersRect.width + movement;
    const newWatchersWidth = Math.max(
      MIN_WATCHERS_AREA_WIDTH,
      Math.min(MAX_WATCHERS_AREA_WIDTH, newDesiredWidth)
    );

    const watchersResizeRect = this._watchersResizeBar.getBoundingClientRect();
    const watchersResizeRight = (newWatchersWidth - watchersResizeRect.width / 2);

    watchers.scrollableContainer.style.width = newWatchersWidth + 'px';
    this._debugConsole.root.style.right = newWatchersWidth + 'px';
    this._watchersResizeBar.style.right = watchersResizeRight + 'px';

    const headerLBorderWidth = 1;
    const watchersLRBorderWidth = 2;
    const extraWidthForHeader = watchersLRBorderWidth - headerLBorderWidth;
    this._debugWatchHeader.root.style.width = newWatchersWidth + extraWidthForHeader + 'px';
  },

  onClearDebugOutput(event) {
    this.props.clearLog();
  },

  render() {
    const {isAttached, canRunNext} = this.props;
    var hasFocus = this.props.isDebuggerPaused;

    var sliderStyle = {
      marginLeft: this.props.debugButtons ? 5 : 45,
      marginRight: 5
    };

    const openStyle = {display: 'block'};
    if (!this.state.open && this.state.transitionType !== 'closing') {
      openStyle.display = 'none';
    }
    let height = this.state.open ? this.state.openedHeight : this.state.closedHeight;
    if (!height && this.props.style) {
      height = this.props.style.height;
    }

    const showWatchPane = this.props.debugWatch && !this.state.watchersHidden;
    return (
      <div
        id="debug-area"
        style={[{transition: 'height 0.4s'}, this.props.style, {height}]}
        onTransitionEnd={this.onTransitionEnd}
        ref={root => this.root = root}
      >
        <div
          id="debugResizeBar"
          className="fa fa-ellipsis-h"
          onMouseDown={this.onMouseDownDebugResizeBar}
          ref={(debugResizeBar) => this._debugResizeBar = debugResizeBar}
        />
        <PaneHeader
          id="debug-area-header"
          hasFocus={hasFocus}
          style={styles.debugAreaHeader}
        >
          <span
            style={styles.noUserSelect}
            className="header-text"
          >
            {i18n.debugConsoleHeader()}
          </span>
          <FontAwesome
            icon={this.state.open ? 'chevron-circle-down' : 'chevron-circle-up'}
            style={styles.showHideIcon}
            onClick={this.slideToggle}
          />
          {this.props.debugButtons &&
          <PaneSection id="debug-commands-header">
            <FontAwesome
              id="running-spinner"
              style={!isAttached || canRunNext ? commonStyles.hidden : {}}
              icon="spinner"
              className="fa-spin"
            />
            <FontAwesome
              id="paused-icon"
              style={!isAttached || !canRunNext ? commonStyles.hidden : {}}
              icon="pause"
            />
            <span
              style={styles.noUserSelect}
              className="header-text"
            >
              {this.state.open ? i18n.debugCommandsHeaderWhenOpen() : i18n.debugCommandsHeaderWhenClosed()}
            </span>
          </PaneSection>
          }
          {this.props.debugWatch &&
          <PaneSection
            id="debug-watch-header"
            ref={debugWatchHeader => this._debugWatchHeader = debugWatchHeader}
            onClick={() => {
              // reset resizer-overridden styles
              // (remove once resize logic migrated to React)
              if (!this.state.watchersHidden) {
                const resetResizeEvent = document.createEvent('Event');
                resetResizeEvent.initEvent('resetWatchersResizableElements', true, true);
                document.dispatchEvent(resetResizeEvent);
              }

              this.setState({watchersHidden: !this.state.watchersHidden});
            }}
            style={this.state.watchersHidden ? {
              borderLeft: 'none',
              textAlign: 'right',
              marginRight: '30px'
            } : {}}
          >
            <FontAwesome
              id="hide-toolbox-icon"
              style={styles.showDebugWatchIcon}
              icon={this.state.watchersHidden ? "chevron-circle-left" : "chevron-circle-right"}
            />
            <span
              style={styles.noUserSelect}
              className="header-text"
            >
              {this.state.watchersHidden ? 'Show Watch' : i18n.debugWatchHeader()}
            </span>
          </PaneSection>
          }
          <PaneButton
            id="clear-console-header"
            iconClass="fa fa-eraser"
            label="Clear"
            headerHasFocus={hasFocus}
            isRtl={false}
            onClick={this.onClearDebugOutput}
          />
          {this.props.debugSlider && <SpeedSlider style={sliderStyle} hasFocus={hasFocus} value={this.props.stepSpeed} lineWidth={130} onChange={this.props.setStepSpeed}/>}
        </PaneHeader>
        {this.props.debugButtons &&
         <DebugButtons style={openStyle}/>}
        {this.props.debugConsole && (
           <DebugConsole
             style={openStyle}
             debugButtons={this.props.debugButtons}
             debugWatch={showWatchPane}
             ref={debugConsole => this._debugConsole = debugConsole}
           />)}
        <div style={{display: showWatchPane ? 'initial' : 'none'}}>
          <ProtectedStatefulDiv>
            <div
              id="watchersResizeBar"
              ref={watchersResizeBar => this._watchersResizeBar = watchersResizeBar}
              onMouseDown={this.onMouseDownWatchersResizeBar}
            />
          </ProtectedStatefulDiv>
        </div>
        {showWatchPane &&
         <ConnectedWatchers
           style={openStyle}
           ref={watchers => this._watchers = watchers}
           debugButtons={this.props.debugButtons}
         />}
      </div>
    );
  }
}));

export default connect(
  (state) => ({
    debugButtons: state.pageConstants.showDebugButtons,
    debugConsole: state.pageConstants.showDebugConsole,
    debugWatch: state.pageConstants.showDebugWatch,
    debugSlider: state.pageConstants.showDebugSlider,
    isDebuggerPaused: state.runState.isDebuggerPaused,
    stepSpeed: state.runState.stepSpeed,
    isAttached: isAttached(state),
    canRunNext: canRunNext(state),
    commandHistory: getCommandHistory(state),
  }),
  {
    setStepSpeed,
    addWatchExpression,
    removeWatchExpression,
    clearLog,
  }
)(UnconnectedJsDebugger);
