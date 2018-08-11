import {
  Component,
  Input, OnDestroy
} from '@angular/core';
import {of} from 'rxjs';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {catchError, map, takeUntil, tap} from 'rxjs/operators';
import {WindowRef} from '../../services/window-ref.service';
import {Snippet} from '../../interfaces/snippet';
import {CodeHighlightService} from '../../services/code-highlight.service';
import {UtilitiesService} from '../../services/utilities.service';
import {Subject} from 'rxjs/Rx';
import {ExemplifyTexts} from '../../interfaces/exemplify-texts';

@Component({
  selector: 'code-snippet',
  templateUrl: './code-snippet.component.html',
  styleUrls: ['./code-snippet.component.scss']
})
export class CodeSnippetComponent implements OnDestroy {

  get texts(): ExemplifyTexts {
    return this._texts;
  }

  @Input() set texts(value: ExemplifyTexts) {
    this._texts = {...this._defaultTexts, ...value};
  }

  get snippet(): Snippet {
    return this._snippet;
  }

  @Input() set snippet(snippet: Snippet) {
    // guess file extension based on source file, note this won't work when source is inline or when raw-loader is used
    const e = snippet.src.split('.');
    const extension = e[e.length - 1];
    this._snippet = {
      ...snippet,
      code: snippet.src.indexOf('http') !== -1 ? this.getSourceCode(snippet.src, snippet.selector) : of(snippet.src), // add snippet code by http request or just returning what's passed
      lang: snippet.lang || (extension.length > 4 ? 'markup' : extension) // if lang is omitted use extension if length is not greater than 4 otherwise default to markup
    };
    // when snippet has loaded highlight the code and store the string representation too (needed for copying etc).
    this.snippet.code
      .pipe(
        takeUntil(this.$unsubscribe)
      )
      .subscribe(code => {
          this.highlight(code, this.snippet.lang);
          this.code = code; // store raw string representation
        }
      );
    this.toggleState(this.snippet.isActive !== false);
  }

  public code: string;
  public isActive: boolean = true;
  public parsedSnippet: string;
  private _window: Window;
  private _snippet: Snippet;
  private $unsubscribe = new Subject();
  private _defaultTexts: ExemplifyTexts = {
    markup: 'markup',
    copy: 'Copy',
    show: 'Show',
    hide: 'Hide',
    sourceNotFound: 'Source not found'
  };
  private _texts: ExemplifyTexts = this._defaultTexts;

  constructor(private _codeHighlight: CodeHighlightService,
              private http: HttpClient,
              private windowRef: WindowRef,
              private utilities: UtilitiesService) {
    this._window = this.windowRef.nativeWindow;
  }

  /** Highlight, highlight code and update value of parsed snippet
   * @param {string} code - code to be highlighted.
   * @param {string} lang - language for code.
   */
  highlight(code: string, lang: string) {
    this.parsedSnippet = this._codeHighlight.highlight(
      code,
      lang
    );
  }

  /** Get source code
   * @param {string} url - url to fetch.
   * @param {string} selector - optional selector for filtering the response.
   */
  private getSourceCode(url: string, selector?: string) {
    return this.http.get(url, {responseType: 'text'})
      .pipe(
        tap(data => {
          if (selector) {
            return this.utilities.parseHtml(data, selector);
          } else {
            return data;
          }
        },
          error => console.log(error)
        ),
        catchError((error: HttpErrorResponse) => {
          if (error.error instanceof ErrorEvent) {
            // a client-side or network error occurred
            console.error('An error occurred:', error.error.message);
          }
          return of(this.texts.sourceNotFound);
        })
      );
  }

  /**
   * Copy to clipboard
   * @param {string} text - text to be copied to clipboard.
   */
  public copyToClipboard = function(text: string) {
    if (this.window.clipboardData && this.window.clipboardData.setData) {
      // IE specific code path to prevent textarea being shown while dialog is visible.
      return this.window.clipboardData.setData('Text', text);

    } else if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
      const textarea = document.createElement('textarea');
      textarea.textContent = text;
      textarea.style.position = 'fixed';  // Prevent scrolling to bottom of page in MS Edge.
      document.body.appendChild(textarea);
      textarea.select();
      try {
        return document.execCommand('copy');  // Security exception may be thrown by some browsers.
      } catch (ex) {
        console.warn('Copy to clipboard failed.', ex);
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  /**
   * Toggle state for code snippet toolbar
   * @param {boolean} state - optional state.
   */
  toggleState(state?: boolean) {
    this.isActive = state || !this.isActive;
  }

  ngOnDestroy(): void {
    this.$unsubscribe.next();
    this.$unsubscribe.complete();
  }

}
