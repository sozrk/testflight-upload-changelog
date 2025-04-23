export type GenericResponse = Paginated<{ id: string }>;

export interface Paginated<T> {
  data: T[];
  meta: {
    paging: {
      total: number;
      limit: number;
    };
  };
}

// https://developer.apple.com/documentation/appstoreconnectapi/BetaBuildLocalizationUpdateRequest
export interface BetaBuildLocalizationUpdateRequest {
  data: {
    id: string;
    type: "betaBuildLocalizations";
    attributes: {
      whatsNew: string;
    };
  };
}

// https://developer.apple.com/documentation/appstoreconnectapi/BetaBuildLocalizationResponse
export interface BetaBuildLocalizationResponse {
  data: {
    attributes?: {
      locale?: string;
    };
  };
}

// https://developer.apple.com/documentation/appstoreconnectapi/ErrorResponse
export interface ErrorResponse {
  errors: ErrorData[];
}

// https://developer.apple.com/documentation/appstoreconnectapi/ErrorResponse/Errors-data.dictionary
export interface ErrorData {
  code: string;
  status: string;
  detail: string;
  source: {
    pointer?: string;
  };
}
